import { ApplicationError } from "@/shared/domain/errors";

export interface PricedItem {
  quantity: number;
  unitPriceCents: number;
}

export interface AppliedPromotion {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minimumSubtotalCents: number;
  maximumDiscountCents: number | null;
}

export interface PriceBreakdown {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  totalCents: number;
  promotionCode: string | null;
}

export function calculatePrice(
  items: readonly PricedItem[],
  currency: string,
  promotion?: AppliedPromotion,
): PriceBreakdown {
  const subtotalCents = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );

  if (subtotalCents < 0 || !Number.isSafeInteger(subtotalCents)) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "The calculated subtotal is invalid",
      422,
    );
  }

  let discountCents = 0;
  if (promotion) {
    if (subtotalCents < promotion.minimumSubtotalCents) {
      throw new ApplicationError(
        "PROMOTION_INVALID",
        `Promotion ${promotion.code} requires a higher subtotal`,
        422,
      );
    }

    discountCents =
      promotion.type === "PERCENTAGE"
        ? Math.floor((subtotalCents * promotion.value) / 100)
        : promotion.value;

    if (promotion.maximumDiscountCents !== null) {
      discountCents = Math.min(discountCents, promotion.maximumDiscountCents);
    }
    discountCents = Math.min(discountCents, subtotalCents);
  }

  const feeCents = Math.round((subtotalCents - discountCents) * 0.05);

  return {
    currency,
    subtotalCents,
    discountCents,
    feeCents,
    totalCents: subtotalCents - discountCents + feeCents,
    promotionCode: promotion?.code ?? null,
  };
}
