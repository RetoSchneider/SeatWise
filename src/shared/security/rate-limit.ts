import { createHmac } from "node:crypto";

import { env } from "@/shared/config/env";
import { ApplicationError } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";

function hashKey(value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(value)
    .digest("hex");
}

export async function enforceRateLimit(input: {
  subject: string;
  action: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = new Date();
  const windowMilliseconds = input.windowSeconds * 1_000;
  const windowStart = new Date(
    Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
  );
  const expiresAt = new Date(windowStart.getTime() + windowMilliseconds * 2);
  const key = hashKey(input.subject);

  const bucket = await database.rateLimitBucket.upsert({
    where: {
      key_action_windowStart: {
        key,
        action: input.action,
        windowStart,
      },
    },
    create: {
      key,
      action: input.action,
      windowStart,
      expiresAt,
    },
    update: {
      count: { increment: 1 },
    },
  });

  if (bucket.count > input.limit) {
    throw new ApplicationError(
      "RATE_LIMITED",
      "Too many requests. Try again shortly.",
      429,
      { retryAfterSeconds: input.windowSeconds },
    );
  }
}
