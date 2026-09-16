import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/shared/config/env";
import type { Clock } from "@/shared/domain/clock";
import { systemClock } from "@/shared/domain/clock";
import { ApplicationError, conflict, notFound } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";
import { serializableTransaction } from "@/shared/infrastructure/transaction";
import { calculatePrice } from "@/modules/pricing/pricing";
import { validatePromotion } from "@/modules/promotions/promotion-service";
import {
  expireReservations,
  expireWithinTransaction,
} from "@/modules/reservations/reservation-expiry-service";

const generalAdmissionSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1).max(8),
});

export const createReservationSchema = z
  .object({
    performanceId: z.string().min(1),
    seatInventoryIds: z.array(z.string().min(1)).max(8).default([]),
    generalAdmission: z.array(generalAdmissionSchema).max(4).default([]),
  })
  .superRefine((value, context) => {
    const total =
      value.seatInventoryIds.length +
      value.generalAdmission.reduce(
        (quantity, item) => quantity + item.quantity,
        0,
      );
    if (
      new Set(value.generalAdmission.map((item) => item.ticketTypeId)).size !==
      value.generalAdmission.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["generalAdmission"],
        message: "A ticket type can only be selected once",
      });
    }
    if (total < 1 || total > 8) {
      context.addIssue({
        code: "custom",
        message: "Select between 1 and 8 tickets",
      });
    }
    if (
      new Set(value.seatInventoryIds).size !== value.seatInventoryIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["seatInventoryIds"],
        message: "A seat can only be selected once",
      });
    }
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export async function createReservation(
  userId: string,
  input: CreateReservationInput,
  clock: Clock = systemClock,
) {
  const now = clock.now();

  return serializableTransaction(async (client) => {
    await expireWithinTransaction(client, now, 100);

    const performance = await client.performance.findUnique({
      where: { id: input.performanceId },
      include: {
        event: true,
        ticketTypes: {
          include: { generalAdmissionInventory: true },
        },
      },
    });

    if (!performance || performance.event.status !== "PUBLISHED") {
      throw notFound("Performance not found");
    }
    if (
      performance.status !== "SCHEDULED" ||
      performance.salesStartAt > now ||
      performance.salesEndAt <= now
    ) {
      throw conflict(
        "INVENTORY_UNAVAILABLE",
        "Tickets are not currently on sale",
      );
    }

    const activeReservationCount = await client.reservation.count({
      where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
    });
    if (activeReservationCount >= 3) {
      throw conflict(
        "CONFLICT",
        "Complete or release an existing reservation before selecting more tickets",
      );
    }

    const durationMinutes =
      performance.reservationDurationMinutes ||
      env.RESERVATION_DURATION_MINUTES;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);
    const reservation = await client.reservation.create({
      data: {
        userId,
        performanceId: performance.id,
        expiresAt,
      },
    });

    const seatInventory = await client.seatInventory.findMany({
      where: {
        id: { in: input.seatInventoryIds },
        performanceId: performance.id,
      },
      include: {
        ticketType: true,
        seat: { include: { row: { include: { section: true } } } },
      },
    });

    if (seatInventory.length !== input.seatInventoryIds.length) {
      throw conflict(
        "INVENTORY_UNAVAILABLE",
        "One or more selected seats are unavailable",
      );
    }

    const reservationItems: Prisma.ReservationItemCreateManyInput[] = [];
    for (const ticketType of performance.ticketTypes) {
      const quantity = seatInventory.filter(
        (seat) => seat.ticketTypeId === ticketType.id,
      ).length;
      if (
        quantity > 0 &&
        (quantity < ticketType.minPerOrder || quantity > ticketType.maxPerOrder)
      ) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          "The selected quantity is outside the ticket type limits",
        );
      }
    }
    for (const inventory of seatInventory) {
      if (
        inventory.ticketType.salesStartAt > now ||
        inventory.ticketType.salesEndAt <= now
      ) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          "One or more selected ticket types are not on sale",
        );
      }

      const reserved = await client.seatInventory.updateMany({
        where: {
          id: inventory.id,
          performanceId: performance.id,
          state: "AVAILABLE",
        },
        data: {
          state: "RESERVED",
          activeReservationId: reservation.id,
          reservedUntil: expiresAt,
          version: { increment: 1 },
        },
      });
      if (reserved.count !== 1) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          `${inventory.seat.row.section.name} ${inventory.seat.row.label}-${inventory.seat.label} was just selected by someone else`,
        );
      }

      reservationItems.push({
        reservationId: reservation.id,
        ticketTypeId: inventory.ticketTypeId,
        seatInventoryId: inventory.id,
        quantity: 1,
        unitPriceCents: inventory.ticketType.priceCents,
        currency: inventory.ticketType.currency,
      });
    }

    const ticketTypes = new Map(
      performance.ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
    );
    for (const requested of input.generalAdmission) {
      const ticketType = ticketTypes.get(requested.ticketTypeId);
      if (
        !ticketType?.generalAdmissionInventory ||
        ticketType.salesStartAt > now ||
        ticketType.salesEndAt <= now ||
        requested.quantity < ticketType.minPerOrder ||
        requested.quantity > ticketType.maxPerOrder
      ) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          "The requested general-admission tickets are unavailable",
        );
      }

      const updated = await client.$queryRaw<Array<{ id: string }>>`
          UPDATE "general_admission_inventory"
          SET "reserved" = "reserved" + ${requested.quantity},
              "version" = "version" + 1,
              "updatedAt" = ${now}
          WHERE "ticketTypeId" = ${ticketType.id}
            AND "capacity" - "reserved" - "sold" >= ${requested.quantity}
          RETURNING "id"
        `;
      if (updated.length !== 1) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          "There are not enough general-admission tickets remaining",
        );
      }

      reservationItems.push({
        reservationId: reservation.id,
        ticketTypeId: ticketType.id,
        seatInventoryId: null,
        quantity: requested.quantity,
        unitPriceCents: ticketType.priceCents,
        currency: ticketType.currency,
      });
    }

    if (new Set(reservationItems.map((item) => item.currency)).size !== 1) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "All tickets in a reservation must use the same currency",
        422,
      );
    }

    await client.reservationItem.createMany({ data: reservationItems });
    const createdItems = await client.reservationItem.findMany({
      where: { reservationId: reservation.id },
    });
    await client.cart.create({
      data: {
        userId,
        reservationId: reservation.id,
        items: {
          create: createdItems.map((item) => ({
            reservationItemId: item.id,
            quantity: item.quantity,
          })),
        },
      },
    });

    return getReservation(client, reservation.id, userId);
  });
}

async function getReservation(
  client: Prisma.TransactionClient | typeof database,
  reservationId: string,
  userId: string,
) {
  const reservation = await client.reservation.findFirst({
    where: { id: reservationId, userId },
    include: {
      performance: {
        include: { event: { include: { venue: true } } },
      },
      items: {
        include: {
          ticketType: true,
          seatInventory: {
            include: {
              seat: { include: { row: { include: { section: true } } } },
            },
          },
        },
      },
      cart: { include: { promotionCode: true } },
    },
  });
  if (!reservation) {
    throw notFound("Reservation not found");
  }

  const promotion = reservation.cart?.promotionCode ?? undefined;
  const price = calculatePrice(
    reservation.items,
    reservation.items[0]?.currency ?? "USD",
    promotion,
  );

  return {
    id: reservation.id,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    remainingSeconds: Math.max(
      0,
      Math.ceil((reservation.expiresAt.getTime() - Date.now()) / 1000),
    ),
    event: {
      title: reservation.performance.event.title,
      slug: reservation.performance.event.slug,
      venue: reservation.performance.event.venue.name,
      startsAt: reservation.performance.startsAt,
      timezone: reservation.performance.event.venue.timezone,
    },
    items: reservation.items.map((item) => ({
      id: item.id,
      ticketType: item.ticketType.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      seat: item.seatInventory
        ? {
            section: item.seatInventory.seat.row.section.name,
            row: item.seatInventory.seat.row.label,
            number: item.seatInventory.seat.label,
          }
        : null,
    })),
    price,
  };
}

export async function getReservationForUser(
  reservationId: string,
  userId: string,
) {
  await expireReservations();
  return getReservation(database, reservationId, userId);
}

export async function applyPromotionToReservation(
  reservationId: string,
  userId: string,
  code: string,
  clock: Clock = systemClock,
) {
  await expireReservations(clock);

  return database.$transaction(async (client) => {
    const reservation = await client.reservation.findFirst({
      where: { id: reservationId, userId },
      include: {
        items: true,
        performance: { include: { event: true } },
        cart: true,
      },
    });
    if (!reservation?.cart) {
      throw notFound("Reservation not found");
    }
    if (
      reservation.status !== "ACTIVE" ||
      reservation.expiresAt <= clock.now()
    ) {
      throw conflict("RESERVATION_EXPIRED", "This reservation has expired");
    }

    const subtotalCents = reservation.items.reduce(
      (total, item) => total + item.quantity * item.unitPriceCents,
      0,
    );
    const promotion = await validatePromotion(
      {
        code,
        userId,
        organizerId: reservation.performance.event.organizerId,
        eventId: reservation.performance.event.id,
        subtotalCents,
        now: clock.now(),
      },
      client,
    );

    await client.cart.update({
      where: { id: reservation.cart.id },
      data: { promotionCodeId: promotion.id },
    });

    return getReservation(client, reservation.id, userId);
  });
}

export async function releaseReservation(
  reservationId: string,
  userId: string,
) {
  return serializableTransaction(async (client) => {
    const reservation = await client.reservation.findFirst({
      where: { id: reservationId, userId },
      include: { items: true },
    });
    if (!reservation) {
      throw notFound("Reservation not found");
    }
    if (reservation.status !== "ACTIVE") {
      return { id: reservation.id, status: reservation.status };
    }

    const released = await client.reservation.updateMany({
      where: { id: reservation.id, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
    if (released.count === 0) {
      throw conflict("CONFLICT", "Reservation state changed");
    }

    await client.seatInventory.updateMany({
      where: { activeReservationId: reservation.id, state: "RESERVED" },
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        version: { increment: 1 },
      },
    });
    for (const item of reservation.items) {
      if (item.seatInventoryId === null) {
        await client.generalAdmissionInventory.update({
          where: { ticketTypeId: item.ticketTypeId },
          data: {
            reserved: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });
      }
    }
    await client.cart.updateMany({
      where: { reservationId: reservation.id, status: "ACTIVE" },
      data: { status: "ABANDONED" },
    });
    return { id: reservation.id, status: "RELEASED" as const };
  });
}
