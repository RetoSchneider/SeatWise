import { z } from "zod";

import type { Clock } from "@/shared/domain/clock";
import { systemClock } from "@/shared/domain/clock";
import { conflict, forbidden, notFound } from "@/shared/domain/errors";
import { secureIdentifierGenerator } from "@/shared/domain/identifiers";
import { database } from "@/shared/infrastructure/database";
import { serializableTransaction } from "@/shared/infrastructure/transaction";
import { recordAuditEvent } from "@/modules/audit/audit-service";

const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/)
  .transform((value) => value.toUpperCase());

export const venueSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(20).max(1_000),
  addressLine1: z.string().trim().min(3).max(120),
  addressLine2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(2).max(20),
  countryCode: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase()),
  timezone: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .refine((timezone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA timezone"),
});

export const venueSectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["RESERVED", "GENERAL_ADMISSION"]),
    capacity: z.number().int().min(1).max(10_000),
    rows: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(10),
          seats: z
            .array(
              z.object({
                label: z.string().trim().min(1).max(10),
                accessible: z.boolean().default(false),
                companionSeat: z.boolean().default(false),
              }),
            )
            .min(1)
            .max(200),
        }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    const seats = value.rows.reduce(
      (total, row) => total + row.seats.length,
      0,
    );
    if (value.type === "RESERVED" && seats !== value.capacity) {
      context.addIssue({
        code: "custom",
        path: ["capacity"],
        message: "Reserved section capacity must equal the number of seats",
      });
    }
    if (value.type === "GENERAL_ADMISSION" && value.rows.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["rows"],
        message: "General-admission sections do not contain assigned seats",
      });
    }
  });

const ticketTypeSchema = z.object({
  sectionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  priceCents: z.number().int().min(0).max(10_000_000),
  currency: currencySchema,
  minPerOrder: z.number().int().min(1).max(8).default(1),
  maxPerOrder: z.number().int().min(1).max(8).default(8),
  capacity: z.number().int().min(1).max(10_000).optional(),
});

function validateSchedule(
  performance: { startsAt: Date; doorsAt?: Date | null; endsAt?: Date | null },
  context: z.RefinementCtx,
) {
  if (performance.doorsAt && performance.doorsAt > performance.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["performance", "doorsAt"],
      message: "Doors must open before the performance starts",
    });
  }
  if (performance.endsAt && performance.endsAt <= performance.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["performance", "endsAt"],
      message: "Performance end must follow its start",
    });
  }
}

export const createEventSchema = z
  .object({
    venueId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(20).max(240),
    description: z.string().trim().min(50).max(5_000),
    category: z.string().trim().min(2).max(60),
    refundPolicy: z
      .enum(["NON_REFUNDABLE", "UNTIL_24_HOURS", "UNTIL_7_DAYS"])
      .default("UNTIL_24_HOURS"),
    performance: z.object({
      startsAt: z.coerce.date(),
      doorsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      salesStartAt: z.coerce.date(),
      salesEndAt: z.coerce.date(),
      reservationDurationMinutes: z.number().int().min(1).max(30).default(10),
    }),
    ticketTypes: z.array(ticketTypeSchema).min(1).max(30),
  })
  .superRefine((value, context) => {
    validateSchedule(value.performance, context);
    if (
      new Set(value.ticketTypes.map((type) => type.sectionId)).size !==
      value.ticketTypes.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["ticketTypes"],
        message: "Each section must have one ticket type",
      });
    }
    if (new Set(value.ticketTypes.map((type) => type.currency)).size !== 1) {
      context.addIssue({
        code: "custom",
        path: ["ticketTypes"],
        message: "All ticket types must use the same currency",
      });
    }
    for (const [index, type] of value.ticketTypes.entries()) {
      if (type.minPerOrder > type.maxPerOrder)
        context.addIssue({
          code: "custom",
          path: ["ticketTypes", index, "maxPerOrder"],
          message: "Maximum must be at least the minimum",
        });
    }
    if (value.performance.salesEndAt > value.performance.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["performance", "salesEndAt"],
        message: "Ticket sales must end before the performance starts",
      });
    }
    if (value.performance.salesStartAt >= value.performance.salesEndAt) {
      context.addIssue({
        code: "custom",
        path: ["performance", "salesStartAt"],
        message: "Sales start must be before sales end",
      });
    }
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(20).max(240),
    description: z.string().trim().min(50).max(5_000),
    category: z.string().trim().min(2).max(60),
    refundPolicy: z.enum(["NON_REFUNDABLE", "UNTIL_24_HOURS", "UNTIL_7_DAYS"]),
    performance: z.object({
      id: z.string().min(1),
      startsAt: z.coerce.date(),
      doorsAt: z.coerce.date().nullable(),
      endsAt: z.coerce.date().nullable(),
      salesStartAt: z.coerce.date(),
      salesEndAt: z.coerce.date(),
      reservationDurationMinutes: z.number().int().min(1).max(30),
    }),
    ticketTypes: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().trim().min(2).max(80),
          description: z.string().trim().max(300).nullable(),
          priceCents: z.number().int().min(0).max(10_000_000),
          minPerOrder: z.number().int().min(1).max(8),
          maxPerOrder: z.number().int().min(1).max(8),
          capacity: z.number().int().min(1).max(10_000).nullable(),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((value, context) => {
    validateSchedule(value.performance, context);
    if (
      value.performance.salesStartAt >= value.performance.salesEndAt ||
      value.performance.salesEndAt > value.performance.startsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["performance", "salesEndAt"],
        message: "Sales must start and end before the performance",
      });
    }
    for (const [index, ticketType] of value.ticketTypes.entries()) {
      if (ticketType.maxPerOrder < ticketType.minPerOrder) {
        context.addIssue({
          code: "custom",
          path: ["ticketTypes", index, "maxPerOrder"],
          message: "Maximum must be at least the minimum",
        });
      }
    }
  });

export const promotionSchema = z.object({
  eventId: z.string().min(1).optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().min(5).max(200),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number().int().min(1),
  minimumSubtotalCents: z.number().int().min(0).default(0),
  maximumDiscountCents: z.number().int().positive().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  redemptionLimit: z.number().int().positive().optional(),
  limitPerCustomer: z.number().int().min(1).max(20).default(1),
});

function slugify(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base}-${secureIdentifierGenerator.token(4).toLowerCase()}`;
}

async function organizerForUser(userId: string) {
  const organizer = await database.organizerProfile.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!organizer) {
    throw forbidden("An active organizer profile is required");
  }
  return organizer;
}

export async function createVenue(
  userId: string,
  input: z.infer<typeof venueSchema>,
) {
  const organizer = await organizerForUser(userId);
  const venue = await database.venue.create({
    data: {
      organizerId: organizer.id,
      slug: slugify(input.name),
      status: "ACTIVE",
      ...input,
    },
  });
  await recordAuditEvent({
    actorUserId: userId,
    action: "VENUE_CREATED",
    entityType: "Venue",
    entityId: venue.id,
    metadata: { name: venue.name },
  });
  return venue;
}

export async function addVenueSection(
  userId: string,
  venueId: string,
  input: z.infer<typeof venueSectionSchema>,
) {
  const organizer = await organizerForUser(userId);
  const venue = await database.venue.findFirst({
    where: { id: venueId, organizerId: organizer.id },
    include: { _count: { select: { sections: true } } },
  });
  if (!venue) {
    throw notFound("Venue not found");
  }

  const section = await database.venueSection.create({
    data: {
      venueId,
      name: input.name,
      type: input.type,
      capacity: input.capacity,
      sortOrder: venue._count.sections + 1,
      rows: {
        create: input.rows.map((row, rowIndex) => ({
          label: row.label,
          sortOrder: rowIndex + 1,
          seats: {
            create: row.seats.map((seat, seatIndex) => ({
              label: seat.label,
              sortOrder: seatIndex + 1,
              accessible: seat.accessible,
              companionSeat: seat.companionSeat,
            })),
          },
        })),
      },
    },
    include: { rows: { include: { seats: true } } },
  });
  await recordAuditEvent({
    actorUserId: userId,
    action: "VENUE_SECTION_CREATED",
    entityType: "VenueSection",
    entityId: section.id,
    metadata: { venueId, type: section.type, capacity: section.capacity },
  });
  return section;
}

export async function createEvent(
  userId: string,
  input: z.infer<typeof createEventSchema>,
  clock: Clock = systemClock,
) {
  const organizer = await organizerForUser(userId);
  if (input.performance.startsAt <= clock.now()) {
    throw conflict("VALIDATION_ERROR", "Performance must be in the future");
  }

  return serializableTransaction(async (client) => {
    const venue = await client.venue.findFirst({
      where: {
        id: input.venueId,
        organizerId: organizer.id,
        status: "ACTIVE",
      },
      include: {
        sections: {
          include: { rows: { include: { seats: true } } },
        },
      },
    });
    if (!venue) {
      throw notFound("Venue not found");
    }

    const sections = new Map(
      venue.sections.map((section) => [section.id, section]),
    );
    for (const ticketType of input.ticketTypes) {
      const section = sections.get(ticketType.sectionId);
      if (!section) {
        throw forbidden("A ticket type references a different venue");
      }
      if (
        section.type === "GENERAL_ADMISSION" &&
        (!ticketType.capacity || ticketType.capacity > section.capacity)
      ) {
        throw conflict(
          "VALIDATION_ERROR",
          `Capacity for ${ticketType.name} must be within the section capacity`,
        );
      }
    }

    const event = await client.event.create({
      data: {
        organizerId: organizer.id,
        venueId: venue.id,
        slug: slugify(input.title),
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        refundPolicy: input.refundPolicy,
        salesStartAt: input.performance.salesStartAt,
        salesEndAt: input.performance.salesEndAt,
      },
    });
    const performance = await client.performance.create({
      data: {
        eventId: event.id,
        ...input.performance,
      },
    });

    for (const requestedType of input.ticketTypes) {
      const section = sections.get(requestedType.sectionId);
      if (!section) {
        throw notFound("Venue section not found");
      }
      const ticketType = await client.ticketType.create({
        data: {
          performanceId: performance.id,
          sectionId: section.id,
          name: requestedType.name,
          description: requestedType.description,
          priceCents: requestedType.priceCents,
          currency: requestedType.currency,
          minPerOrder: requestedType.minPerOrder,
          maxPerOrder: requestedType.maxPerOrder,
          salesStartAt: input.performance.salesStartAt,
          salesEndAt: input.performance.salesEndAt,
        },
      });

      if (section.type === "GENERAL_ADMISSION") {
        await client.generalAdmissionInventory.create({
          data: {
            performanceId: performance.id,
            ticketTypeId: ticketType.id,
            capacity: requestedType.capacity ?? section.capacity,
          },
        });
      } else {
        const seats = section.rows.flatMap((row) => row.seats);
        await client.seatInventory.createMany({
          data: seats.map((seat) => ({
            performanceId: performance.id,
            seatId: seat.id,
            ticketTypeId: ticketType.id,
          })),
        });
      }
    }

    await recordAuditEvent(
      {
        actorUserId: userId,
        action: "EVENT_CREATED",
        entityType: "Event",
        entityId: event.id,
        metadata: { title: event.title, performanceId: performance.id },
      },
      client,
    );
    return client.event.findUniqueOrThrow({
      where: { id: event.id },
      include: {
        venue: true,
        performances: {
          include: {
            ticketTypes: true,
            _count: { select: { seatInventory: true } },
          },
        },
      },
    });
  });
}

export async function getOrganizerEvent(userId: string, eventId: string) {
  const organizer = await organizerForUser(userId);
  const event = await database.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    include: {
      venue: true,
      performances: {
        orderBy: { startsAt: "asc" },
        include: {
          ticketTypes: {
            include: { generalAdmissionInventory: true, section: true },
          },
        },
      },
    },
  });
  if (!event) {
    throw notFound("Event not found");
  }
  return event;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: z.infer<typeof updateEventSchema>,
) {
  const organizer = await organizerForUser(userId);

  return serializableTransaction(async (client) => {
    const event = await client.event.findFirst({
      where: { id: eventId, organizerId: organizer.id },
      include: {
        performances: {
          include: {
            ticketTypes: {
              include: { generalAdmissionInventory: true, section: true },
            },
          },
        },
      },
    });
    if (!event) {
      throw notFound("Event not found");
    }
    if (event.status === "CANCELLED") {
      throw conflict("CONFLICT", "A cancelled event cannot be edited");
    }
    const performance = event.performances.find(
      (item) => item.id === input.performance.id,
    );
    if (!performance) {
      throw forbidden("Performance does not belong to this event");
    }
    const existingTicketTypes = new Map(
      performance.ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
    );
    if (
      new Set(input.ticketTypes.map((type) => type.id)).size !==
        existingTicketTypes.size ||
      input.ticketTypes.length !== existingTicketTypes.size
    ) {
      throw conflict(
        "VALIDATION_ERROR",
        "Supply each existing ticket type exactly once",
      );
    }
    if (
      input.ticketTypes.some(
        (ticketType) => !existingTicketTypes.has(ticketType.id),
      )
    ) {
      throw forbidden("Ticket type does not belong to this event");
    }

    await client.event.update({
      where: { id: event.id },
      data: {
        title: input.title,
        summary: input.summary,
        description: input.description,
        category: input.category,
        refundPolicy: input.refundPolicy,
        salesStartAt: input.performance.salesStartAt,
        salesEndAt: input.performance.salesEndAt,
      },
    });
    await client.performance.update({
      where: { id: performance.id },
      data: {
        startsAt: input.performance.startsAt,
        doorsAt: input.performance.doorsAt,
        endsAt: input.performance.endsAt,
        salesStartAt: input.performance.salesStartAt,
        salesEndAt: input.performance.salesEndAt,
        reservationDurationMinutes:
          input.performance.reservationDurationMinutes,
      },
    });

    for (const requested of input.ticketTypes) {
      const current = existingTicketTypes.get(requested.id);
      if (!current) {
        throw notFound("Ticket type not found");
      }
      await client.ticketType.update({
        where: { id: current.id },
        data: {
          name: requested.name,
          description: requested.description,
          priceCents: requested.priceCents,
          minPerOrder: requested.minPerOrder,
          maxPerOrder: requested.maxPerOrder,
          salesStartAt: input.performance.salesStartAt,
          salesEndAt: input.performance.salesEndAt,
        },
      });
      if (current.generalAdmissionInventory && requested.capacity) {
        if (
          requested.capacity <
            current.generalAdmissionInventory.reserved +
              current.generalAdmissionInventory.sold ||
          requested.capacity > (current.section?.capacity ?? 0)
        ) {
          throw conflict(
            "CONFLICT",
            `Capacity for ${current.name} is outside the available section range`,
          );
        }
        await client.generalAdmissionInventory.update({
          where: { id: current.generalAdmissionInventory.id },
          data: { capacity: requested.capacity, version: { increment: 1 } },
        });
      }
    }

    await recordAuditEvent(
      {
        actorUserId: userId,
        action: "EVENT_UPDATED",
        entityType: "Event",
        entityId: event.id,
        metadata: {
          performanceId: performance.id,
          ticketTypeCount: input.ticketTypes.length,
        },
      },
      client,
    );
    return client.event.findUniqueOrThrow({
      where: { id: event.id },
      include: {
        performances: { include: { ticketTypes: true } },
      },
    });
  });
}

export async function setEventStatus(
  userId: string,
  eventId: string,
  action: "PUBLISH" | "UNPUBLISH" | "CANCEL",
  clock: Clock = systemClock,
) {
  const organizer = await organizerForUser(userId);
  const event = await database.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    include: {
      performances: {
        include: {
          _count: {
            select: {
              seatInventory: true,
              generalAdmissionInventory: true,
            },
          },
        },
      },
    },
  });
  if (!event) {
    throw notFound("Event not found");
  }
  if (event.status === "CANCELLED")
    throw conflict("CONFLICT", "A cancelled event cannot change status");
  if (
    action === "PUBLISH" &&
    (event.performances.length === 0 ||
      event.performances.every(
        (performance) =>
          performance._count.seatInventory === 0 &&
          performance._count.generalAdmissionInventory === 0,
      ))
  ) {
    throw conflict(
      "CONFLICT",
      "Add a performance with inventory before publishing",
    );
  }

  const status =
    action === "PUBLISH"
      ? "PUBLISHED"
      : action === "UNPUBLISH"
        ? "UNPUBLISHED"
        : "CANCELLED";
  const updated = await database.event.update({
    where: { id: event.id },
    data: {
      status,
      publishedAt: action === "PUBLISH" ? clock.now() : event.publishedAt,
      cancelledAt: action === "CANCEL" ? clock.now() : null,
      performances:
        action === "CANCEL"
          ? { updateMany: { where: {}, data: { status: "CANCELLED" } } }
          : undefined,
    },
  });
  await recordAuditEvent({
    actorUserId: userId,
    action: `EVENT_${action}`,
    entityType: "Event",
    entityId: event.id,
    metadata: { previousStatus: event.status, status },
  });
  return updated;
}

export async function createPromotion(
  userId: string,
  input: z.infer<typeof promotionSchema>,
) {
  const organizer = await organizerForUser(userId);
  if (input.endsAt <= input.startsAt) {
    throw conflict("VALIDATION_ERROR", "Promotion end must be after its start");
  }
  if (input.type === "PERCENTAGE" && input.value > 100) {
    throw conflict("VALIDATION_ERROR", "Percentage cannot exceed 100");
  }
  if (input.eventId) {
    const event = await database.event.findFirst({
      where: { id: input.eventId, organizerId: organizer.id },
      select: { id: true },
    });
    if (!event) {
      throw forbidden("A promotion can only target your own event");
    }
  }

  const promotion = await database.promotionCode.create({
    data: {
      organizerId: organizer.id,
      eventId: input.eventId,
      code: input.code,
      description: input.description,
      type: input.type,
      value: input.value,
      minimumSubtotalCents: input.minimumSubtotalCents,
      maximumDiscountCents: input.maximumDiscountCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      redemptionLimit: input.redemptionLimit,
      limitPerCustomer: input.limitPerCustomer,
    },
  });
  await recordAuditEvent({
    actorUserId: userId,
    action: "PROMOTION_CREATED",
    entityType: "PromotionCode",
    entityId: promotion.id,
    metadata: { code: promotion.code, eventId: promotion.eventId },
  });
  return promotion;
}

export async function getOrganizerDashboard(userId: string) {
  const organizer = await organizerForUser(userId);
  const [events, venues, paidOrders, pendingRefunds] = await Promise.all([
    database.event.findMany({
      where: { organizerId: organizer.id },
      orderBy: { createdAt: "desc" },
      include: {
        venue: true,
        performances: {
          include: {
            _count: { select: { tickets: true } },
            seatInventory: { select: { state: true } },
            generalAdmissionInventory: true,
          },
        },
      },
    }),
    database.venue.findMany({
      where: { organizerId: organizer.id },
      include: { sections: true },
      orderBy: { createdAt: "desc" },
    }),
    database.order.aggregate({
      where: { organizerId: organizer.id, status: "PAID" },
      _sum: { totalCents: true },
      _count: true,
    }),
    database.refundRequest.count({
      where: {
        status: "REQUESTED",
        order: { organizerId: organizer.id },
      },
    }),
  ]);

  return {
    organizer,
    events,
    venues,
    summary: {
      paidOrders: paidOrders._count,
      grossSalesCents: paidOrders._sum.totalCents ?? 0,
      pendingRefunds,
    },
  };
}

export async function listOrganizerOrders(userId: string) {
  const organizer = await organizerForUser(userId);
  return database.order.findMany({
    where: { organizerId: organizer.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      performance: { include: { event: true } },
      tickets: { select: { id: true, status: true } },
      refundRequests: true,
    },
    take: 100,
  });
}

export async function listOrganizerPromotions(userId: string) {
  const organizer = await organizerForUser(userId);
  return database.promotionCode.findMany({
    where: { organizerId: organizer.id },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true } },
      _count: { select: { redemptions: true } },
    },
  });
}
