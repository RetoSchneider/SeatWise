import { createHash } from "node:crypto";

import { env } from "@/shared/config/env";

export type PaymentOutcome =
  | { status: "SUCCEEDED"; providerReference: string }
  | {
      status: "DECLINED" | "TIMED_OUT" | "FAILED";
      code: string;
      message: string;
    };

export interface PaymentProvider {
  charge(input: {
    amountCents: number;
    currency: string;
    paymentToken: string;
    idempotencyKey: string;
  }): Promise<PaymentOutcome>;
  refund(input: {
    amountCents: number;
    currency: string;
    paymentReference: string;
    idempotencyKey: string;
  }): Promise<PaymentOutcome>;
}

function reference(prefix: string, idempotencyKey: string) {
  return `${prefix}_${createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 20)}`;
}

async function simulateLatency() {
  await new Promise((resolve) =>
    setTimeout(resolve, env.PAYMENT_SIMULATOR_DELAY_MS),
  );
}

export const localPaymentProvider: PaymentProvider = {
  async charge(input) {
    await simulateLatency();

    switch (input.paymentToken) {
      case "pm_success":
        return {
          status: "SUCCEEDED",
          providerReference: reference("pay", input.idempotencyKey),
        };
      case "pm_decline":
        return {
          status: "DECLINED",
          code: "card_declined",
          message: "The simulated payment was declined.",
        };
      case "pm_timeout":
        return {
          status: "TIMED_OUT",
          code: "provider_timeout",
          message: "The payment provider did not respond in time.",
        };
      case "pm_transient":
        return {
          status: "FAILED",
          code: "provider_unavailable",
          message: "The payment provider is temporarily unavailable.",
        };
      default:
        return {
          status: "DECLINED",
          code: "invalid_test_token",
          message: "Use a documented SeatWise payment simulator token.",
        };
    }
  },

  async refund(input) {
    await simulateLatency();
    return {
      status: "SUCCEEDED",
      providerReference: reference("ref", input.idempotencyKey),
    };
  },
};
