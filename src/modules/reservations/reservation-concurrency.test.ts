import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { database } from "@/shared/infrastructure/database";
import { createReservation } from "@/modules/reservations/reservation-service";

const testUsers = ["test_concurrency_one", "test_concurrency_two"];
const inventoryId = "inventory_midnight_seat_floor_a_8";

async function cleanFixtures() {
  const reservations = await database.reservation.findMany({
    where: { userId: { in: testUsers } },
    select: { id: true },
  });
  const reservationIds = reservations.map((reservation) => reservation.id);

  if (reservationIds.length > 0) {
    await database.cartItem.deleteMany({
      where: { cart: { reservationId: { in: reservationIds } } },
    });
    await database.cart.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await database.seatInventory.updateMany({
      where: { activeReservationId: { in: reservationIds } },
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        version: { increment: 1 },
      },
    });
    await database.reservationItem.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await database.reservation.deleteMany({
      where: { id: { in: reservationIds } },
    });
  }
  await database.user.deleteMany({ where: { id: { in: testUsers } } });
}

describe("seat reservation concurrency", () => {
  beforeAll(async () => {
    await cleanFixtures();
    await database.user.createMany({
      data: testUsers.map((id, index) => ({
        id,
        name: `Concurrency Customer ${index + 1}`,
        email: `concurrency-${index + 1}@seatwise.test`,
        emailVerified: true,
      })),
    });
    await database.seatInventory.update({
      where: { id: inventoryId },
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        soldOrderLineId: null,
      },
    });
  });

  afterAll(async () => {
    await cleanFixtures();
    await database.$disconnect();
  });

  it("allows only one transaction to claim the same seat", async () => {
    const attempts = await Promise.allSettled(
      testUsers.map((userId) =>
        createReservation(userId, {
          performanceId: "performance_midnight_signals",
          seatInventoryIds: [inventoryId],
          generalAdmission: [],
        }),
      ),
    );

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);

    const inventory = await database.seatInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    expect(inventory.state).toBe("RESERVED");
    expect(inventory.activeReservationId).toBeTruthy();
  });
});
