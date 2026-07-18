import { z } from "zod";

import { conflict, notFound } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";
import { paginationMeta } from "@/shared/http/pagination";
import { recordAuditEvent } from "@/modules/audit/audit-service";

export const updateUserRoleSchema = z.object({
  role: z.enum(["CUSTOMER", "ORGANIZER", "ADMINISTRATOR"]),
});

export const updateOrganizerStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function getAdminDashboard() {
  const [
    users,
    organizers,
    publishedEvents,
    pendingRefunds,
    recentAudit,
    databaseHealth,
  ] = await Promise.all([
    database.user.count(),
    database.organizerProfile.count(),
    database.event.count({ where: { status: "PUBLISHED" } }),
    database.refundRequest.count({ where: { status: "REQUESTED" } }),
    database.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true, email: true } } },
    }),
    database.$queryRaw<Array<{ checkedAt: Date }>>`SELECT NOW() AS "checkedAt"`,
  ]);

  return {
    summary: {
      users,
      organizers,
      publishedEvents,
      pendingRefunds,
      database: databaseHealth.length === 1 ? "ready" : "unavailable",
    },
    recentAudit,
  };
}

export function listUsers() {
  return database.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      createdAt: true,
      organizerProfile: {
        select: { id: true, displayName: true, status: true },
      },
    },
    take: 200,
  });
}

export async function updateUserRole(
  actorUserId: string,
  userId: string,
  role: "CUSTOMER" | "ORGANIZER" | "ADMINISTRATOR",
) {
  const user = await database.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound("User not found");
  }
  if (actorUserId === userId && role !== "ADMINISTRATOR") {
    throw conflict(
      "CONFLICT",
      "Administrators cannot remove their own administrator role",
    );
  }

  const updated = await database.$transaction(async (client) => {
    const changed = await client.user.update({
      where: { id: user.id },
      data: {
        role,
        organizerProfile:
          role === "ORGANIZER" && user.role !== "ORGANIZER"
            ? {
                upsert: {
                  create: {
                    displayName: user.name,
                    supportEmail: user.email,
                    status: "PENDING",
                  },
                  update: {},
                },
              }
            : undefined,
      },
    });
    await recordAuditEvent(
      {
        actorUserId,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: user.id,
        metadata: { previousRole: user.role, role },
      },
      client,
    );
    return changed;
  });
  return updated;
}

export async function updateOrganizerStatus(
  actorUserId: string,
  organizerId: string,
  status: "PENDING" | "ACTIVE" | "SUSPENDED",
) {
  const organizer = await database.organizerProfile.findUnique({
    where: { id: organizerId },
  });
  if (!organizer) {
    throw notFound("Organizer not found");
  }

  const updated = await database.$transaction(async (client) => {
    const changed = await client.organizerProfile.update({
      where: { id: organizer.id },
      data: { status },
    });
    await recordAuditEvent(
      {
        actorUserId,
        action: "ORGANIZER_STATUS_CHANGED",
        entityType: "OrganizerProfile",
        entityId: organizer.id,
        metadata: { previousStatus: organizer.status, status },
      },
      client,
    );
    return changed;
  });
  return updated;
}

export async function listAuditEvents(query: z.infer<typeof auditQuerySchema>) {
  const where = query.action
    ? { action: { contains: query.action, mode: "insensitive" as const } }
    : {};
  const [events, total] = await Promise.all([
    database.auditEvent.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    database.auditEvent.count({ where }),
  ]);
  return {
    events,
    meta: paginationMeta(query.page, query.pageSize, total),
  };
}

export function listAdminEvents() {
  return database.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organizer: { select: { displayName: true, status: true } },
      venue: { select: { name: true, city: true } },
      performances: { orderBy: { startsAt: "asc" }, take: 1 },
    },
    take: 200,
  });
}

export async function moderateEvent(
  actorUserId: string,
  eventId: string,
  action: "UNPUBLISH" | "CANCEL",
) {
  const event = await database.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw notFound("Event not found");
  }
  const status = action === "CANCEL" ? "CANCELLED" : "UNPUBLISHED";
  const updated = await database.$transaction(async (client) => {
    const changed = await client.event.update({
      where: { id: event.id },
      data: {
        status,
        cancelledAt: action === "CANCEL" ? new Date() : event.cancelledAt,
        performances:
          action === "CANCEL"
            ? { updateMany: { where: {}, data: { status: "CANCELLED" } } }
            : undefined,
      },
    });
    await recordAuditEvent(
      {
        actorUserId,
        action: `ADMIN_EVENT_${action}`,
        entityType: "Event",
        entityId: event.id,
        metadata: { previousStatus: event.status, status },
      },
      client,
    );
    return changed;
  });
  return updated;
}

export function listPendingRefunds() {
  return database.refundRequest.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: {
      requester: { select: { name: true, email: true } },
      order: {
        include: {
          organizer: { select: { displayName: true } },
          performance: { include: { event: true } },
        },
      },
    },
  });
}
