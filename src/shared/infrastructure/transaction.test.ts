import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { isTransactionConflict } from "./transaction";

describe("transaction conflict classification", () => {
  it.each(["40001", "40P01"])(
    "recognizes adapter SQLSTATE %s at commit",
    (originalCode) => {
      const error = new Error("Transaction conflict", {
        cause: { originalCode },
      });
      error.name = "DriverAdapterError";
      expect(isTransactionConflict(error)).toBe(true);
    },
  );

  it("recognizes wrapped raw-query conflicts", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Conflict", {
      code: "P2010",
      clientVersion: "7.10.0",
      meta: { driverAdapterError: { cause: { originalCode: "40001" } } },
    });
    expect(isTransactionConflict(error)).toBe(true);
  });

  it("recognizes Prisma transaction conflicts", () => {
    expect(
      isTransactionConflict(
        new Prisma.PrismaClientKnownRequestError("Conflict", {
          code: "P2034",
          clientVersion: "7.10.0",
        }),
      ),
    ).toBe(true);
  });

  it("does not retry validation or unrelated database failures", () => {
    const error = new Error("Unique constraint", {
      cause: { originalCode: "23505" },
    });
    error.name = "DriverAdapterError";
    expect(isTransactionConflict(error)).toBe(false);
    expect(isTransactionConflict(new Error("Connection refused"))).toBe(false);
  });
});
