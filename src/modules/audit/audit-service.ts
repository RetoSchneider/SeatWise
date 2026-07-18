import { createHmac } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/shared/config/env";
import { database } from "@/shared/infrastructure/database";

type AuditClient = Pick<typeof database, "auditEvent">;

export interface AuditContext {
  actorUserId?: string;
  request?: Request;
}

function requestIpHash(request?: Request) {
  const address = request?.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (!address) {
    return undefined;
  }
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(address)
    .digest("hex");
}

export function recordAuditEvent(
  input: AuditContext & {
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
  client: AuditClient = database,
) {
  return client.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipHash: requestIpHash(input.request),
      userAgent: input.request?.headers.get("user-agent")?.slice(0, 500),
      metadata: input.metadata ?? {},
    },
  });
}
