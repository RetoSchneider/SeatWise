import { describe, expect, it } from "vitest";

import { localPaymentProvider } from "@/modules/payments/payment-provider";

describe("localPaymentProvider", () => {
  it.each([
    ["pm_success", "SUCCEEDED"],
    ["pm_decline", "DECLINED"],
    ["pm_timeout", "TIMED_OUT"],
    ["pm_transient", "FAILED"],
  ] as const)(
    "maps %s to a deterministic %s outcome",
    async (token, status) => {
      const outcome = await localPaymentProvider.charge({
        amountCents: 1_000,
        currency: "USD",
        paymentToken: token,
        idempotencyKey: `test-${token}`,
      });

      expect(outcome.status).toBe(status);
    },
  );

  it("returns the same provider reference for a repeated key", async () => {
    const input = {
      amountCents: 1_000,
      currency: "USD",
      paymentToken: "pm_success",
      idempotencyKey: "same-idempotency-key",
    };

    const first = await localPaymentProvider.charge(input);
    const second = await localPaymentProvider.charge(input);

    expect(first).toEqual(second);
  });
});
