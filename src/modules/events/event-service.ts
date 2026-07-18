import { z } from "zod";

import { notFound } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";
import { paginationMeta } from "@/shared/http/pagination";
import { expireReservations } from "@/modules/reservations/reservation-expiry-service";

export const eventCatalogSchema = z.object({
  query: z.string().trim().max(100).default(""),
  category: z.string().trim().max(60).default(""),
  city: z.string().trim().max(80).default(""),
  sort: z.enum(["date", "title"]).default("date"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export type EventCatalogQuery = z.infer<typeof eventCatalogSchema>;

export async function listPublishedEvents(query: EventCatalogQuery) {
  const now = new Date();
  const where = {
    status: "PUBLISHED" as const,
    performances: {
      some: {
        status: "SCHEDULED" as const,
        startsAt: { gt: now },
        salesEndAt: { gt: now },
      },
    },
    ...(query.query
      ? {
          OR: [
            { title: { contains: query.query, mode: "insensitive" as const } },
            {
              summary: { contains: query.query, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
    ...(query.category
      ? { category: { equals: query.category, mode: "insensitive" as const } }
      : {}),
    ...(query.city
      ? {
          venue: {
            city: { equals: query.city, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    database.event.findMany({
      where,
      include: {
        venue: true,
        performances: {
          where: {
            status: "SCHEDULED",
            startsAt: { gt: now },
            salesEndAt: { gt: now },
          },
          orderBy: { startsAt: "asc" },
          take: 1,
          include: {
            ticketTypes: {
              orderBy: { priceCents: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy:
        query.sort === "title"
          ? { title: "asc" }
          : { performances: { _count: "desc" } },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    database.event.count({ where }),
  ]);

  const mapped = events
    .map((event) => {
      const performance = event.performances[0];
      if (!performance) {
        return null;
      }
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        category: event.category,
        venue: {
          name: event.venue.name,
          city: event.venue.city,
          region: event.venue.region,
        },
        nextPerformance: performance.startsAt,
        startingPriceCents: performance.ticketTypes[0]?.priceCents ?? null,
        currency: performance.ticketTypes[0]?.currency ?? "USD",
      };
    })
    .filter((event) => event !== null);

  if (query.sort === "date") {
    mapped.sort(
      (first, second) =>
        first.nextPerformance.getTime() - second.nextPerformance.getTime(),
    );
  }

  return {
    events: mapped,
    meta: paginationMeta(query.page, query.pageSize, total),
  };
}

export async function getPublishedEvent(slug: string) {
  await expireReservations();
  const now = new Date();
  const event = await database.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      venue: true,
      performances: {
        where: { startsAt: { gt: now }, status: "SCHEDULED" },
        orderBy: { startsAt: "asc" },
        include: {
          ticketTypes: {
            orderBy: { priceCents: "asc" },
            include: { generalAdmissionInventory: true, section: true },
          },
          seatInventory: {
            include: {
              ticketType: true,
              seat: {
                include: { row: { include: { section: true } } },
              },
            },
            orderBy: { seat: { sortOrder: "asc" } },
          },
        },
      },
    },
  });

  if (!event) {
    throw notFound("Event not found");
  }

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    description: event.description,
    category: event.category,
    refundPolicy: event.refundPolicy,
    venue: {
      name: event.venue.name,
      description: event.venue.description,
      address: [
        event.venue.addressLine1,
        event.venue.city,
        event.venue.region,
        event.venue.postalCode,
      ].join(", "),
      timezone: event.venue.timezone,
    },
    performances: event.performances.map((performance) => ({
      id: performance.id,
      startsAt: performance.startsAt,
      doorsAt: performance.doorsAt,
      reservationDurationMinutes: performance.reservationDurationMinutes,
      ticketTypes: performance.ticketTypes.map((ticketType) => ({
        id: ticketType.id,
        name: ticketType.name,
        description: ticketType.description,
        priceCents: ticketType.priceCents,
        currency: ticketType.currency,
        section: ticketType.section?.name ?? null,
        generalAdmission: ticketType.generalAdmissionInventory
          ? {
              capacity: ticketType.generalAdmissionInventory.capacity,
              available:
                ticketType.generalAdmissionInventory.capacity -
                ticketType.generalAdmissionInventory.reserved -
                ticketType.generalAdmissionInventory.sold,
            }
          : null,
      })),
      seats: performance.seatInventory.map((inventory) => ({
        inventoryId: inventory.id,
        state: inventory.state,
        section: inventory.seat.row.section.name,
        sectionOrder: inventory.seat.row.section.sortOrder,
        row: inventory.seat.row.label,
        rowOrder: inventory.seat.row.sortOrder,
        seat: inventory.seat.label,
        seatOrder: inventory.seat.sortOrder,
        accessible: inventory.seat.accessible,
        companionSeat: inventory.seat.companionSeat,
        ticketType: inventory.ticketType.name,
        priceCents: inventory.ticketType.priceCents,
        currency: inventory.ticketType.currency,
      })),
    })),
  };
}
