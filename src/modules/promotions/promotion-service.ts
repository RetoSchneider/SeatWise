import type { AppliedPromotion } from "@/modules/pricing/pricing";
import { ApplicationError } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";

type PromotionClient = Pick<typeof database, "promotionCode" | "order">;

export async function validatePromotion(
  input: {
    code: string;
    userId: string;
    organizerId: string;
    eventId: string;
    subtotalCents: number;
    now: Date;
  },
  client: PromotionClient = database,
): Promise<AppliedPromotion> {
  const code = input.code.trim().toUpperCase();
  const promotion = await client.promotionCode.findUnique({ where: { code } });

  if (
    !promotion ||
    !promotion.active ||
    promotion.organizerId !== input.organizerId ||
    (promotion.eventId !== null && promotion.eventId !== input.eventId) ||
    promotion.startsAt > input.now ||
    promotion.endsAt <= input.now
  ) {
    throw new ApplicationError(
      "PROMOTION_INVALID",
      "This promotion is not valid for the selected event",
      422,
    );
  }

  if (input.subtotalCents < promotion.minimumSubtotalCents) {
    throw new ApplicationError(
      "PROMOTION_INVALID",
      `This promotion requires a subtotal of at least ${promotion.minimumSubtotalCents} cents`,
      422,
    );
  }

  const [totalRedemptions, customerRedemptions] = await Promise.all([
    client.order.count({
      where: {
        promotionCodeId: promotion.id,
        status: { notIn: ["PAYMENT_FAILED", "CANCELLED"] },
      },
    }),
    client.order.count({
      where: {
        promotionCodeId: promotion.id,
        userId: input.userId,
        status: { notIn: ["PAYMENT_FAILED", "CANCELLED"] },
      },
    }),
  ]);

  if (
    (promotion.redemptionLimit !== null &&
      totalRedemptions >= promotion.redemptionLimit) ||
    customerRedemptions >= promotion.limitPerCustomer
  ) {
    throw new ApplicationError(
      "PROMOTION_INVALID",
      "This promotion has reached its redemption limit",
      422,
    );
  }

  return {
    id: promotion.id,
    code: promotion.code,
    type: promotion.type,
    value: promotion.value,
    minimumSubtotalCents: promotion.minimumSubtotalCents,
    maximumDiscountCents: promotion.maximumDiscountCents,
  };
}
