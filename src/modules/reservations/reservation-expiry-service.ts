import type { Prisma } from "@/generated/prisma/client";
import type { Clock } from "@/shared/domain/clock";
import { systemClock } from "@/shared/domain/clock";
import { database } from "@/shared/infrastructure/database";

async function expireWithinTransaction(
  client: Prisma.TransactionClient,
  now: Date,
  batchSize: number,
) {
  const candidates = await client.reservation.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      items: {
        select: {
          ticketTypeId: true,
          seatInventoryId: true,
          quantity: true,
        },
      },
    },
    orderBy: { expiresAt: "asc" },
    take: batchSize,
  });

  let expiredCount = 0;
  for (const candidate of candidates) {
    const claimed = await client.reservation.updateMany({
      where: { id: candidate.id, status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    if (claimed.count === 0) {
      continue;
    }

    expiredCount += 1;
    await client.seatInventory.updateMany({
      where: {
        activeReservationId: candidate.id,
        state: "RESERVED",
      },
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        version: { increment: 1 },
      },
    });

    const generalAdmissionQuantities = new Map<string, number>();
    for (const item of candidate.items) {
      if (item.seatInventoryId === null) {
        generalAdmissionQuantities.set(
          item.ticketTypeId,
          (generalAdmissionQuantities.get(item.ticketTypeId) ?? 0) +
            item.quantity,
        );
      }
    }

    for (const [ticketTypeId, quantity] of generalAdmissionQuantities) {
      await client.generalAdmissionInventory.update({
        where: { ticketTypeId },
        data: {
          reserved: { decrement: quantity },
          version: { increment: 1 },
        },
      });
    }

    await client.cart.updateMany({
      where: { reservationId: candidate.id, status: "ACTIVE" },
      data: { status: "ABANDONED" },
    });
  }

  return expiredCount;
}

export function expireReservations(
  clock: Clock = systemClock,
  batchSize = 100,
) {
  return database.$transaction(
    (client) => expireWithinTransaction(client, clock.now(), batchSize),
    { isolationLevel: "Serializable" },
  );
}

export { expireWithinTransaction };
