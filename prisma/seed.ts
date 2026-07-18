import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/modules/identity/password";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development demo data cannot be seeded in production.");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed SeatWise.");
}

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const demoPassword = "SeatWise!2026";

async function clearDatabase() {
  await database.$transaction([
    database.seatInventory.updateMany({
      data: {
        state: "AVAILABLE",
        activeReservationId: null,
        reservedUntil: null,
        soldOrderLineId: null,
      },
    }),
    database.rateLimitBucket.deleteMany(),
    database.auditEvent.deleteMany(),
    database.notification.deleteMany(),
    database.refund.deleteMany(),
    database.refundRequest.deleteMany(),
    database.ticket.deleteMany(),
    database.paymentAttempt.deleteMany(),
    database.promotionRedemption.deleteMany(),
    database.orderLine.deleteMany(),
    database.order.deleteMany(),
    database.cartItem.deleteMany(),
    database.cart.deleteMany(),
    database.reservationItem.deleteMany(),
    database.seatInventory.deleteMany(),
    database.generalAdmissionInventory.deleteMany(),
    database.reservation.deleteMany(),
    database.promotionCode.deleteMany(),
    database.ticketType.deleteMany(),
    database.performance.deleteMany(),
    database.event.deleteMany(),
    database.seat.deleteMany(),
    database.venueRow.deleteMany(),
    database.venueSection.deleteMany(),
    database.venue.deleteMany(),
    database.organizerProfile.deleteMany(),
    database.verification.deleteMany(),
    database.session.deleteMany(),
    database.account.deleteMany(),
    database.user.deleteMany(),
  ]);
}

async function createDemoUsers() {
  const password = await hashPassword(demoPassword);
  const users = [
    {
      id: "user_customer_demo",
      name: "Katja Morgenstern",
      email: "customer@seatwise.local",
      role: "CUSTOMER" as const,
    },
    {
      id: "user_organizer_demo",
      name: "Jonas Ley",
      email: "organizer@seatwise.local",
      role: "ORGANIZER" as const,
    },
    {
      id: "user_admin_demo",
      name: "Alexandra Chen",
      email: "admin@seatwise.local",
      role: "ADMINISTRATOR" as const,
    },
  ];

  for (const user of users) {
    await database.user.create({
      data: {
        ...user,
        emailVerified: true,
        accounts: {
          create: {
            id: `account_${user.role.toLowerCase()}_demo`,
            accountId: user.id,
            providerId: "credential",
            password,
          },
        },
      },
    });
  }
}

async function createVenue() {
  const organizer = await database.organizerProfile.create({
    data: {
      id: "organizer_demo",
      userId: "user_organizer_demo",
      displayName: "Nordlicht Live",
      supportEmail: "organizer@seatwise.local",
      status: "ACTIVE",
    },
  });

  const venue = await database.venue.create({
    data: {
      id: "venue_harbor_hall",
      organizerId: organizer.id,
      name: "Hafenhalle",
      slug: "hafenhalle",
      description:
        "Eine restaurierte Veranstaltungshalle am Wasser mit klarer Sicht und stufenlosem Zugang.",
      addressLine1: "Hafenstrasse 84",
      city: "Zürich",
      region: "ZH",
      postalCode: "8005",
      countryCode: "CH",
      timezone: "Europe/Zurich",
      status: "ACTIVE",
    },
  });

  const floor = await database.venueSection.create({
    data: {
      id: "section_main_floor",
      venueId: venue.id,
      name: "Parkett",
      type: "RESERVED",
      sortOrder: 1,
      capacity: 24,
    },
  });
  for (const [rowIndex, label] of ["A", "B", "C"].entries()) {
    await database.venueRow.create({
      data: {
        id: `row_floor_${label.toLowerCase()}`,
        sectionId: floor.id,
        label,
        sortOrder: rowIndex + 1,
        seats: {
          create: Array.from({ length: 8 }, (_, seatIndex) => ({
            id: `seat_floor_${label.toLowerCase()}_${seatIndex + 1}`,
            label: String(seatIndex + 1),
            sortOrder: seatIndex + 1,
            accessible: label === "A" && seatIndex < 2,
            companionSeat: label === "A" && seatIndex === 2,
          })),
        },
      },
    });
  }

  const balcony = await database.venueSection.create({
    data: {
      id: "section_balcony",
      venueId: venue.id,
      name: "Balkon",
      type: "RESERVED",
      sortOrder: 2,
      capacity: 16,
    },
  });
  for (const [rowIndex, label] of ["D", "E"].entries()) {
    await database.venueRow.create({
      data: {
        id: `row_balcony_${label.toLowerCase()}`,
        sectionId: balcony.id,
        label,
        sortOrder: rowIndex + 1,
        seats: {
          create: Array.from({ length: 8 }, (_, seatIndex) => ({
            id: `seat_balcony_${label.toLowerCase()}_${seatIndex + 1}`,
            label: String(seatIndex + 1),
            sortOrder: seatIndex + 1,
          })),
        },
      },
    });
  }

  const generalAdmission = await database.venueSection.create({
    data: {
      id: "section_studio",
      venueId: venue.id,
      name: "Studio",
      type: "GENERAL_ADMISSION",
      sortOrder: 3,
      capacity: 120,
    },
  });

  return { organizer, venue, floor, balcony, generalAdmission };
}

async function createEvents(
  venueData: Awaited<ReturnType<typeof createVenue>>,
) {
  const concert = await database.event.create({
    data: {
      id: "event_midnight_signals",
      organizerId: venueData.organizer.id,
      venueId: venueData.venue.id,
      slug: "mitternachtssignale",
      title: "Mitternachtssignale",
      summary:
        "Ein intimer Abend mit filmischer elektronischer Musik und Live-Visuals.",
      description:
        "Mitternachtssignale verbindet ein sechsköpfiges elektronisches Ensemble mit reaktiver Projektionskunst, die in Echtzeit entsteht. Die Produktion ist auf die Hafenhalle zugeschnitten und führt von zurückhaltenden Ambient-Passagen zu einem hellen Finale im ganzen Raum. Einlass ist eine Stunde vor der Aufführung, ein barrierefreier Zugang steht von der Hafenstrasse aus zur Verfügung.",
      category: "Musik",
      status: "PUBLISHED",
      refundPolicy: "UNTIL_24_HOURS",
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-09-20T22:00:00.000Z"),
      publishedAt: new Date("2026-07-01T12:00:00.000Z"),
    },
  });
  const performance = await database.performance.create({
    data: {
      id: "performance_midnight_signals",
      eventId: concert.id,
      startsAt: new Date("2030-09-21T00:00:00.000Z"),
      doorsAt: new Date("2030-09-20T23:00:00.000Z"),
      endsAt: new Date("2030-09-21T02:15:00.000Z"),
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-09-20T22:00:00.000Z"),
      reservationDurationMinutes: 10,
    },
  });
  const floorTicket = await database.ticketType.create({
    data: {
      id: "ticket_type_floor",
      performanceId: performance.id,
      sectionId: venueData.floor.id,
      name: "Parkett",
      description: "Zugewiesene Plätze im Parkett",
      priceCents: 6800,
      currency: "CHF",
      minPerOrder: 1,
      maxPerOrder: 8,
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-09-20T22:00:00.000Z"),
    },
  });
  const balconyTicket = await database.ticketType.create({
    data: {
      id: "ticket_type_balcony",
      performanceId: performance.id,
      sectionId: venueData.balcony.id,
      name: "Balkon",
      description: "Zugewiesene Plätze mit erhöhter Sicht",
      priceCents: 4400,
      currency: "CHF",
      minPerOrder: 1,
      maxPerOrder: 8,
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-09-20T22:00:00.000Z"),
    },
  });
  const floorSeats = await database.seat.findMany({
    where: { row: { sectionId: venueData.floor.id } },
  });
  const balconySeats = await database.seat.findMany({
    where: { row: { sectionId: venueData.balcony.id } },
  });
  await database.seatInventory.createMany({
    data: [
      ...floorSeats.map((seat) => ({
        id: `inventory_midnight_${seat.id}`,
        performanceId: performance.id,
        seatId: seat.id,
        ticketTypeId: floorTicket.id,
      })),
      ...balconySeats.map((seat) => ({
        id: `inventory_midnight_${seat.id}`,
        performanceId: performance.id,
        seatId: seat.id,
        ticketTypeId: balconyTicket.id,
      })),
    ],
  });

  const stories = await database.event.create({
    data: {
      id: "event_city_stories",
      organizerId: venueData.organizer.id,
      venueId: venueData.venue.id,
      slug: "stadtgeschichten-live",
      title: "Stadtgeschichten Live",
      summary:
        "Wahre Geschichten, eigene Musik und ein Raum zum gemeinsamen Zuhören.",
      description:
        "Stadtgeschichten Live bringt Autorinnen, Musiker und Nachbarn für einen sorgfältig produzierten Abend mit Erzählungen aus der Ich-Perspektive zusammen. Jede Aufführung präsentiert neue Stimmen, verbunden durch ein Thema, mit einem lockeren Gespräch im Foyer nach der Show.",
      category: "Vorträge",
      status: "PUBLISHED",
      refundPolicy: "UNTIL_7_DAYS",
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-10-12T21:00:00.000Z"),
      publishedAt: new Date("2026-07-02T12:00:00.000Z"),
    },
  });
  const storiesPerformance = await database.performance.create({
    data: {
      id: "performance_city_stories",
      eventId: stories.id,
      startsAt: new Date("2030-10-12T23:00:00.000Z"),
      doorsAt: new Date("2030-10-12T22:30:00.000Z"),
      endsAt: new Date("2030-10-13T01:00:00.000Z"),
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-10-12T21:00:00.000Z"),
      reservationDurationMinutes: 8,
    },
  });
  const storiesTicket = await database.ticketType.create({
    data: {
      id: "ticket_type_stories_ga",
      performanceId: storiesPerformance.id,
      sectionId: venueData.generalAdmission.id,
      name: "Freie Platzwahl",
      description: "Studio-Einlass ohne Platzzuweisung",
      priceCents: 2800,
      currency: "CHF",
      minPerOrder: 1,
      maxPerOrder: 8,
      salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-10-12T21:00:00.000Z"),
    },
  });
  await database.generalAdmissionInventory.create({
    data: {
      id: "ga_inventory_city_stories",
      performanceId: storiesPerformance.id,
      ticketTypeId: storiesTicket.id,
      capacity: 120,
    },
  });

  await database.promotionCode.create({
    data: {
      id: "promotion_welcome15",
      organizerId: venueData.organizer.id,
      eventId: concert.id,
      code: "WELCOME15",
      description: "Fünfzehn Prozent Rabatt auf Mitternachtssignale",
      type: "PERCENTAGE",
      value: 15,
      minimumSubtotalCents: 4000,
      maximumDiscountCents: 3000,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2030-09-01T00:00:00.000Z"),
      redemptionLimit: 100,
      limitPerCustomer: 1,
    },
  });
}

async function main() {
  await clearDatabase();
  await createDemoUsers();
  const venue = await createVenue();
  await createEvents(venue);
  await database.auditEvent.create({
    data: {
      id: "audit_seed_complete",
      actorUserId: "user_admin_demo",
      action: "DEVELOPMENT_DATA_SEEDED",
      entityType: "System",
      entityId: "seatwise",
      metadata: { dataset: "portfolio-demo-v1" },
    },
  });
  console.info("SeatWise development data seeded.");
  console.info("Demo password for all accounts: SeatWise!2026");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
