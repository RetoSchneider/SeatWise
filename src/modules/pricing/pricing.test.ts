import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/shared/domain/errors";
import { calculatePrice } from "@/modules/pricing/pricing";

describe("calculatePrice", () => {
  it("calculates percentage discounts and fees in integer cents", () => {
    const price = calculatePrice(
      [
        { quantity: 2, unitPriceCents: 5_000 },
        { quantity: 1, unitPriceCents: 2_500 },
      ],
      "USD",
      {
        id: "promotion",
        code: "SAVE20",
        type: "PERCENTAGE",
        value: 20,
        minimumSubtotalCents: 0,
        maximumDiscountCents: null,
      },
    );

    expect(price).toEqual({
      currency: "USD",
      subtotalCents: 12_500,
      discountCents: 2_500,
      feeCents: 500,
      totalCents: 10_500,
      promotionCode: "SAVE20",
    });
  });

  it("caps discounts at the subtotal", () => {
    const price = calculatePrice(
      [{ quantity: 1, unitPriceCents: 2_000 }],
      "USD",
      {
        id: "promotion",
        code: "BIG",
        type: "FIXED_AMOUNT",
        value: 5_000,
        minimumSubtotalCents: 0,
        maximumDiscountCents: null,
      },
    );

    expect(price.totalCents).toBe(0);
    expect(price.discountCents).toBe(2_000);
  });

  it("rejects a promotion below its minimum subtotal", () => {
    expect(() =>
      calculatePrice([{ quantity: 1, unitPriceCents: 500 }], "USD", {
        id: "promotion",
        code: "MINIMUM",
        type: "PERCENTAGE",
        value: 10,
        minimumSubtotalCents: 1_000,
        maximumDiscountCents: null,
      }),
    ).toThrow(ApplicationError);
  });
});
