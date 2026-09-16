import "./environment";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/modules/identity/password";

export const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

export const password = "SeatWise!Test2026";

export async function createScenario() {
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const startsAt = new Date(now + 30 * 86_400_000);
  const salesStartAt = new Date(now - 86_400_000);
  const salesEndAt = new Date(now + 29 * 86_400_000);
  const users = await Promise.all(
    (["CUSTOMER", "CUSTOMER", "ORGANIZER", "ADMINISTRATOR"] as const).map(
      (role, index) =>
        database.user.create({
          data: {
            id: `${id}-${index}`,
            name: `Test ${role} ${index}`,
            email: `${id}-${index}@seatwise.test`,
            emailVerified: true,
            role,
            accounts: {
              create: {
                accountId: `${id}-${index}`,
                providerId: "credential",
                password: passwordHash,
              },
            },
          },
        }),
    ),
  );
  const [customer, otherCustomer, organizerUser, administrator] = users;
  const organizer = await database.organizerProfile.create({
    data: {
      userId: organizerUser.id,
      displayName: "Test Organizer",
      supportEmail: organizerUser.email,
      status: "ACTIVE",
    },
  });
  const venue = await database.venue.create({
    data: {
      organizerId: organizer.id,
      slug: `venue-${id}`,
      name: "Test Concert Hall",
      description: "An isolated venue for automated ticketing tests.",
      addressLine1: "Teststrasse 1",
      city: "Zurich",
      region: "Zurich",
      postalCode: "8000",
      countryCode: "CH",
      timezone: "Europe/Zurich",
      status: "ACTIVE",
      sections: {
        create: [
          {
            name: "Floor",
            type: "RESERVED",
            capacity: 2,
            sortOrder: 1,
            rows: {
              create: {
                label: "A",
                sortOrder: 1,
                seats: {
                  create: [
                    { label: "1", sortOrder: 1 },
                    { label: "2", sortOrder: 2, accessible: true },
                  ],
                },
              },
            },
          },
          {
            name: "Standing",
            type: "GENERAL_ADMISSION",
            capacity: 8,
            sortOrder: 2,
          },
        ],
      },
    },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          rows: { include: { seats: { orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
  });
  const event = await database.event.create({
    data: {
      organizerId: organizer.id,
      venueId: venue.id,
      slug: `concert-${id}`,
      title: `Test Concert ${id}`,
      summary: "An isolated concert for reliable automation coverage.",
      description:
        "Choose an assigned seat or a standing ticket for this isolated test concert.",
      category: `test-${id}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      performances: { create: { startsAt, salesStartAt, salesEndAt } },
    },
    include: { performances: true },
  });
  const performance = event.performances[0];
  const assigned = await database.ticketType.create({
    data: {
      performanceId: performance.id,
      sectionId: venue.sections[0].id,
      name: "Assigned seat",
      priceCents: 5000,
      currency: "CHF",
      salesStartAt,
      salesEndAt,
      seatInventory: {
        create: venue.sections[0].rows[0].seats.map((seat) => ({
          seatId: seat.id,
          performanceId: performance.id,
        })),
      },
    },
    include: { seatInventory: { orderBy: { seat: { sortOrder: "asc" } } } },
  });
  const standing = await database.ticketType.create({
    data: {
      performanceId: performance.id,
      sectionId: venue.sections[1].id,
      name: "Standing ticket",
      priceCents: 3000,
      currency: "CHF",
      salesStartAt,
      salesEndAt,
      generalAdmissionInventory: {
        create: { performanceId: performance.id, capacity: 8 },
      },
    },
  });
  const promotion = await database.promotionCode.create({
    data: {
      organizerId: organizer.id,
      eventId: event.id,
      code: id.replaceAll("-", "").slice(0, 24).toUpperCase(),
      description: "Test discount",
      type: "PERCENTAGE",
      value: 15,
      startsAt: salesStartAt,
      endsAt: salesEndAt,
      redemptionLimit: 1,
    },
  });
  return {
    id,
    customer,
    otherCustomer,
    organizerUser,
    administrator,
    organizer,
    venue,
    event,
    performance,
    assigned,
    standing,
    promotion,
    userIds: users.map((user) => user.id),
  };
}

export type Scenario = Awaited<ReturnType<typeof createScenario>>;

export async function removeScenario(scenario: Scenario) {
  const order = { organizerId: scenario.organizer.id };
  const user = { in: scenario.userIds };
  const performance = { event: { organizerId: scenario.organizer.id } };
  await database.$transaction(async (client) => {
    await client.seatInventory.updateMany({
      where: { performance },
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        soldOrderLineId: null,
      },
    });
    await client.refund.deleteMany({ where: { order } });
    await client.refundRequest.deleteMany({ where: { order } });
    await client.ticket.deleteMany({ where: { order } });
    await client.promotionRedemption.deleteMany({ where: { order } });
    await client.orderLine.deleteMany({ where: { order } });
    await client.order.deleteMany({ where: order });
    await client.reservation.deleteMany({ where: { userId: user } });
    await client.seatInventory.deleteMany({ where: { performance } });
    await client.event.deleteMany({
      where: { organizerId: scenario.organizer.id },
    });
    await client.venue.deleteMany({
      where: { organizerId: scenario.organizer.id },
    });
    await client.organizerProfile.delete({
      where: { id: scenario.organizer.id },
    });
    await client.auditEvent.deleteMany({ where: { actorUserId: user } });
    await client.user.deleteMany({ where: { id: user } });
  });
}
