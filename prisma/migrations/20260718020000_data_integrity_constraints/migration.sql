ALTER TABLE "venue_sections"
  ADD CONSTRAINT "venue_sections_capacity_positive" CHECK ("capacity" > 0);

ALTER TABLE "performances"
  ADD CONSTRAINT "performances_sales_window_valid"
    CHECK ("salesStartAt" < "salesEndAt" AND "salesEndAt" <= "startsAt"),
  ADD CONSTRAINT "performances_reservation_duration_valid"
    CHECK ("reservationDurationMinutes" BETWEEN 1 AND 30);

ALTER TABLE "ticket_types"
  ADD CONSTRAINT "ticket_types_price_nonnegative" CHECK ("priceCents" >= 0),
  ADD CONSTRAINT "ticket_types_order_limits_valid"
    CHECK ("minPerOrder" > 0 AND "maxPerOrder" >= "minPerOrder" AND "maxPerOrder" <= 20),
  ADD CONSTRAINT "ticket_types_sales_window_valid"
    CHECK ("salesStartAt" < "salesEndAt");

ALTER TABLE "seat_inventory"
  ADD CONSTRAINT "seat_inventory_state_consistent" CHECK (
    (
      "state" = 'AVAILABLE'
      AND "activeReservationId" IS NULL
      AND "reservedUntil" IS NULL
      AND "soldOrderLineId" IS NULL
    )
    OR (
      "state" = 'RESERVED'
      AND "activeReservationId" IS NOT NULL
      AND "reservedUntil" IS NOT NULL
      AND "soldOrderLineId" IS NULL
    )
    OR (
      "state" = 'SOLD'
      AND "activeReservationId" IS NULL
      AND "reservedUntil" IS NULL
      AND "soldOrderLineId" IS NOT NULL
    )
    OR (
      "state" = 'BLOCKED'
      AND "activeReservationId" IS NULL
      AND "reservedUntil" IS NULL
      AND "soldOrderLineId" IS NULL
    )
  );

ALTER TABLE "general_admission_inventory"
  ADD CONSTRAINT "ga_inventory_counts_valid"
    CHECK (
      "capacity" > 0
      AND "reserved" >= 0
      AND "sold" >= 0
      AND "reserved" + "sold" <= "capacity"
    );

ALTER TABLE "reservation_items"
  ADD CONSTRAINT "reservation_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "reservation_items_price_nonnegative" CHECK ("unitPriceCents" >= 0),
  ADD CONSTRAINT "reservation_items_shape_valid"
    CHECK (
      ("seatInventoryId" IS NULL AND "quantity" > 0)
      OR ("seatInventoryId" IS NOT NULL AND "quantity" = 1)
    );

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "promotion_codes"
  ADD CONSTRAINT "promotion_codes_dates_valid" CHECK ("startsAt" < "endsAt"),
  ADD CONSTRAINT "promotion_codes_value_valid" CHECK (
    ("type" = 'PERCENTAGE' AND "value" BETWEEN 1 AND 100)
    OR ("type" = 'FIXED_AMOUNT' AND "value" > 0)
  ),
  ADD CONSTRAINT "promotion_codes_limits_valid" CHECK (
    "minimumSubtotalCents" >= 0
    AND ("maximumDiscountCents" IS NULL OR "maximumDiscountCents" > 0)
    AND ("redemptionLimit" IS NULL OR "redemptionLimit" > 0)
    AND "limitPerCustomer" > 0
  );

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_totals_valid" CHECK (
    "subtotalCents" >= 0
    AND "discountCents" >= 0
    AND "discountCents" <= "subtotalCents"
    AND "feeCents" >= 0
    AND "totalCents" = "subtotalCents" - "discountCents" + "feeCents"
  );

ALTER TABLE "order_lines"
  ADD CONSTRAINT "order_lines_totals_valid" CHECK (
    "quantity" > 0
    AND "unitPriceCents" >= 0
    AND "totalCents" = "quantity" * "unitPriceCents"
  );

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_amount_nonnegative" CHECK ("amountCents" >= 0),
  ADD CONSTRAINT "payment_attempts_attempt_positive" CHECK ("attemptNumber" > 0);

ALTER TABLE "refund_requests"
  ADD CONSTRAINT "refund_requests_amounts_valid" CHECK (
    "requestedAmountCents" > 0
    AND ("processedAmountCents" IS NULL OR "processedAmountCents" BETWEEN 0 AND "requestedAmountCents")
  );

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive" CHECK ("amountCents" > 0);

ALTER TABLE "rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_valid" CHECK (
    "count" > 0 AND "expiresAt" > "windowStart"
  );
