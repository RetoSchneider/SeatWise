import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/shared/config/env";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var seatwisePrisma: PrismaClient | undefined;
}

function createDatabaseClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? [{ emit: "event", level: "error" }]
        : undefined,
  });
}

export const database = globalThis.seatwisePrisma ?? createDatabaseClient();

if (env.NODE_ENV !== "production") {
  globalThis.seatwisePrisma = database;
}
