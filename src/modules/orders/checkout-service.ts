import { createHash } from "node:crypto";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { Clock } from "@/shared/domain/clock";
import { systemClock } from "@/shared/domain/clock";
import { ApplicationError, conflict, notFound } from "@/shared/domain/errors";
import {
  createDisplayNumber,
  secureIdentifierGenerator,
  type IdentifierGenerator,
} from "@/shared/domain/identifiers";
import { database } from "@/shared/infrastructure/database";
import { serializableTransaction } from "@/shared/infrastructure/transaction";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import { notificationService } from "@/modules/notifications/notification-service";
import {
  localPaymentProvider,
  type PaymentOutcome,
  type PaymentProvider,
} from "@/modules/payments/payment-provider";
import { calculatePrice } from "@/modules/pricing/pricing";
import { validatePromotion } from "@/modules/promotions/promotion-service";
import {
  expireReservations,
  expireWithinTransaction,
} from "@/modules/reservations/reservation-expiry-service";

export const checkoutSchema = z.object({
  reservationId: z.string().min(1),
  paymentToken: z.string().min(1).max(100),
});

interface CheckoutDependencies {
  clock: Clock;
  identifiers: IdentifierGenerator;
  paymentProvider: PaymentProvider;
}

const defaultDependencies: CheckoutDependencies = {
  clock: systemClock,
  identifiers: secureIdentifierGenerator,
  paymentProvider: localPaymentProvider,
};

const checkoutInclude = {
  lines: true,
  paymentAttempts: { orderBy: { attemptNumber: "desc" as const } },
  tickets: true,
  user: true,
  performance: { include: { event: { include: { venue: true } } } },
};

export async function checkout(
  userId: string,
  input: z.infer<typeof checkoutSchema>,
  idempotencyKey: string,
  dependencies: CheckoutDependencies = defaultDependencies,
) {
  const now = dependencies.clock.now();
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  await expireReservations(dependencies.clock);

  let order = await database.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: checkoutInclude,
  });

  if (!order) {
    try {
      order = await prepareOrder(
        userId,
        input.reservationId,
        idempotencyKey,
        requestHash,
        now,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        order = await database.order.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: checkoutInclude,
        });
      } else {
        throw error;
      }
    }
  }

  if (!order) {
    throw new ApplicationError(
      "INTERNAL_ERROR",
      "The checkout could not be initialized",
      500,
    );
  }

  if (
    order.reservationId !== input.reservationId ||
    (order.requestHash !== null && order.requestHash !== requestHash)
  ) {
    throw conflict(
      "CONFLICT",
      "This idempotency key belongs to a different checkout request",
    );
  }

  if (["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.status)) {
    return toCheckoutResult(order);
  }
  if (order.status === "PAYMENT_FAILED") {
    throwPaymentError(order.id, order.paymentAttempts[0]?.status);
  }

  const attempt = order.paymentAttempts[0];
  if (!attempt) {
    throw new ApplicationError(
      "INTERNAL_ERROR",
      "The payment attempt could not be found",
      500,
    );
  }

  const outcome = await dependencies.paymentProvider.charge({
    amountCents: order.totalCents,
    currency: order.currency,
    paymentToken: input.paymentToken,
    idempotencyKey: attempt.idempotencyKey,
  });

  if (outcome.status !== "SUCCEEDED") {
    await failPayment(order.id, attempt.id, outcome, dependencies.clock.now());
    throwPaymentError(order.id, outcome.status);
  }

  const paidOrder = await completePayment(
    order.id,
    attempt.id,
    outcome,
    dependencies,
  );

  await notificationService.sendEmail({
    userId: paidOrder.userId,
    recipient: paidOrder.user.email,
    type: "ORDER_CONFIRMATION",
    subject: `Your SeatWise tickets for ${paidOrder.performance.event.title}`,
    body: [
      `Order ${paidOrder.orderNumber} is confirmed.`,
      `${paidOrder.performance.event.title}`,
      `${paidOrder.performance.startsAt.toISOString()} UTC`,
      `${paidOrder.performance.event.venue.name}`,
      `${paidOrder.tickets.length} ticket${paidOrder.tickets.length === 1 ? "" : "s"}`,
      `Total: ${paidOrder.currency} ${(paidOrder.totalCents / 100).toFixed(2)}`,
      "",
      `View your tickets: ${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/account/tickets`,
    ].join("\n"),
  });

  return toCheckoutResult(paidOrder);
}

async function prepareOrder(
  userId: string,
  reservationId: string,
  idempotencyKey: string,
  requestHash: string,
  now: Date,
) {
  return serializableTransaction(async (client) => {
    await expireWithinTransaction(client, now, 100);

    const reservation = await client.reservation.findFirst({
      where: { id: reservationId, userId },
      include: {
        items: {
          include: {
            ticketType: true,
            seatInventory: {
              include: {
                seat: {
                  include: { row: { include: { section: true } } },
                },
              },
            },
          },
        },
        cart: { include: { promotionCode: true } },
        performance: { include: { event: true } },
      },
    });

    if (!reservation?.cart) {
      throw notFound("Reservation not found");
    }
    if (reservation.status !== "ACTIVE" || reservation.expiresAt <= now) {
      throw conflict("RESERVATION_EXPIRED", "This reservation has expired");
    }
    if (
      reservation.performance.event.status !== "PUBLISHED" ||
      reservation.performance.status !== "SCHEDULED" ||
      reservation.performance.salesStartAt > now ||
      reservation.performance.salesEndAt <= now
    ) {
      throw conflict(
        "INVENTORY_UNAVAILABLE",
        "Tickets are not currently on sale",
      );
    }
    if (reservation.items.length === 0) {
      throw conflict("CONFLICT", "The reservation is empty");
    }

    for (const item of reservation.items) {
      if (
        item.unitPriceCents !== item.ticketType.priceCents ||
        item.currency !== item.ticketType.currency
      ) {
        throw conflict(
          "CONFLICT",
          "Ticket prices changed. Release this reservation and select tickets again.",
        );
      }
      if (
        item.seatInventory &&
        (item.seatInventory.state !== "RESERVED" ||
          item.seatInventory.activeReservationId !== reservation.id ||
          item.seatInventory.reservedUntil === null ||
          item.seatInventory.reservedUntil <= now)
      ) {
        throw conflict(
          "INVENTORY_UNAVAILABLE",
          "A reserved seat is no longer available",
        );
      }
    }

    const subtotalCents = reservation.items.reduce(
      (total, item) => total + item.quantity * item.unitPriceCents,
      0,
    );
    const promotion = reservation.cart.promotionCode
      ? await validatePromotion(
          {
            code: reservation.cart.promotionCode.code,
            userId,
            organizerId: reservation.performance.event.organizerId,
            eventId: reservation.performance.event.id,
            subtotalCents,
            now,
          },
          client,
        )
      : undefined;
    const price = calculatePrice(
      reservation.items,
      reservation.items[0]?.currency ?? "USD",
      promotion,
    );

    const claimed = await client.reservation.updateMany({
      where: { id: reservation.id, status: "ACTIVE", expiresAt: { gt: now } },
      data: { status: "CHECKOUT_PENDING" },
    });
    if (claimed.count !== 1) {
      throw conflict("RESERVATION_EXPIRED", "This reservation has expired");
    }

    const order = await client.order.create({
      data: {
        orderNumber: createDisplayNumber("SW", now),
        userId,
        organizerId: reservation.performance.event.organizerId,
        performanceId: reservation.performanceId,
        reservationId: reservation.id,
        promotionCodeId: promotion?.id,
        idempotencyKey,
        requestHash,
        currency: price.currency,
        subtotalCents: price.subtotalCents,
        discountCents: price.discountCents,
        feeCents: price.feeCents,
        totalCents: price.totalCents,
        lines: {
          create: reservation.items.map((item) => ({
            performanceId: reservation.performanceId,
            ticketTypeId: item.ticketTypeId,
            reservationItemId: item.id,
            description: item.seatInventory
              ? `${item.ticketType.name} · ${item.seatInventory.seat.row.section.name}, row ${item.seatInventory.seat.row.label}, seat ${item.seatInventory.seat.label}`
              : item.ticketType.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.quantity * item.unitPriceCents,
          })),
        },
        paymentAttempts: {
          create: {
            provider: "local-simulator",
            attemptNumber: 1,
            amountCents: price.totalCents,
            currency: price.currency,
            idempotencyKey: `pay:${userId}:${idempotencyKey}`,
          },
        },
      },
      include: checkoutInclude,
    });

    await recordAuditEvent(
      {
        actorUserId: userId,
        action: "ORDER_CHECKOUT_STARTED",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          currency: order.currency,
        },
      },
      client,
    );

    return order;
  });
}

async function completePayment(
  orderId: string,
  paymentAttemptId: string,
  outcome: Extract<PaymentOutcome, { status: "SUCCEEDED" }>,
  dependencies: CheckoutDependencies,
) {
  const now = dependencies.clock.now();

  return serializableTransaction(async (client) => {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        ...checkoutInclude,
        reservation: { include: { items: true, cart: true } },
      },
    });
    if (!order) {
      throw notFound("Order not found");
    }
    if (order.status === "PAID") {
      return order;
    }

    const claimed = await client.paymentAttempt.updateMany({
      where: { id: paymentAttemptId, status: "PROCESSING" },
      data: {
        status: "SUCCEEDED",
        providerReference: outcome.providerReference,
        completedAt: now,
      },
    });
    if (claimed.count !== 1) {
      const completed = await client.order.findUnique({
        where: { id: orderId },
        include: {
          ...checkoutInclude,
          reservation: { include: { items: true, cart: true } },
        },
      });
      if (!completed) {
        throw notFound("Order not found");
      }
      return completed;
    }

    if (order.reservation.status !== "CHECKOUT_PENDING") {
      throw conflict(
        "RESERVATION_EXPIRED",
        "The reservation changed while payment was processing",
      );
    }

    const linesByReservationItem = new Map(
      order.lines.map((line) => [line.reservationItemId, line]),
    );
    const tickets: Prisma.TicketCreateManyInput[] = [];

    for (const item of order.reservation.items) {
      const line = linesByReservationItem.get(item.id);
      if (!line) {
        throw new ApplicationError(
          "INTERNAL_ERROR",
          "An order line is missing",
          500,
        );
      }

      if (item.seatInventoryId) {
        const sold = await client.seatInventory.updateMany({
          where: {
            id: item.seatInventoryId,
            state: "RESERVED",
            activeReservationId: order.reservationId,
          },
          data: {
            state: "SOLD",
            activeReservationId: null,
            reservedUntil: null,
            soldOrderLineId: line.id,
            version: { increment: 1 },
          },
        });
        if (sold.count !== 1) {
          throw conflict(
            "INVENTORY_UNAVAILABLE",
            "A reserved seat could not be completed",
          );
        }
      } else {
        const updated = await client.$queryRaw<Array<{ id: string }>>`
            UPDATE "general_admission_inventory"
            SET "reserved" = "reserved" - ${item.quantity},
                "sold" = "sold" + ${item.quantity},
                "version" = "version" + 1,
                "updatedAt" = ${now}
            WHERE "ticketTypeId" = ${item.ticketTypeId}
              AND "reserved" >= ${item.quantity}
            RETURNING "id"
          `;
        if (updated.length !== 1) {
          throw conflict(
            "INVENTORY_UNAVAILABLE",
            "General-admission inventory could not be completed",
          );
        }
      }

      for (let ticketIndex = 0; ticketIndex < item.quantity; ticketIndex += 1) {
        tickets.push({
          ticketNumber: createDisplayNumber("TKT", now),
          qrToken: dependencies.identifiers.token(),
          orderId: order.id,
          orderLineId: line.id,
          userId: order.userId,
          performanceId: order.performanceId,
          seatId: item.seatInventoryId
            ? (
                await client.seatInventory.findUniqueOrThrow({
                  where: { id: item.seatInventoryId },
                  select: { seatId: true },
                })
              ).seatId
            : null,
        });
      }
    }

    await client.ticket.createMany({ data: tickets });
    await client.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: now },
    });
    await client.reservation.update({
      where: { id: order.reservationId },
      data: { status: "CHECKED_OUT" },
    });
    await client.cart.updateMany({
      where: { reservationId: order.reservationId },
      data: { status: "CONVERTED" },
    });
    if (order.promotionCodeId) {
      await client.promotionRedemption.create({
        data: {
          promotionCodeId: order.promotionCodeId,
          userId: order.userId,
          orderId: order.id,
          discountCents: order.discountCents,
        },
      });
    }
    await recordAuditEvent(
      {
        actorUserId: order.userId,
        action: "ORDER_PAID",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          paymentAttemptId,
          ticketCount: tickets.length,
        },
      },
      client,
    );

    return client.order.findUniqueOrThrow({
      where: { id: order.id },
      include: checkoutInclude,
    });
  });
}

async function failPayment(
  orderId: string,
  paymentAttemptId: string,
  outcome: Exclude<PaymentOutcome, { status: "SUCCEEDED" }>,
  now: Date,
) {
  await database.$transaction(async (client) => {
    const claimed = await client.paymentAttempt.updateMany({
      where: { id: paymentAttemptId, status: "PROCESSING" },
      data: {
        status: outcome.status,
        failureCode: outcome.code,
        failureMessage: outcome.message,
        completedAt: now,
      },
    });
    if (claimed.count === 0) {
      return;
    }

    const order = await client.order.update({
      where: { id: orderId },
      data: { status: "PAYMENT_FAILED" },
    });
    await client.reservation.updateMany({
      where: { id: order.reservationId, status: "CHECKOUT_PENDING" },
      data: { status: "ACTIVE" },
    });
    await recordAuditEvent(
      {
        actorUserId: order.userId,
        action: "PAYMENT_FAILED",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          paymentAttemptId,
          outcome: outcome.status,
          code: outcome.code,
        },
      },
      client,
    );
  });
}

function throwPaymentError(orderId: string, status?: string): never {
  if (status === "DECLINED") {
    throw new ApplicationError(
      "PAYMENT_DECLINED",
      "Payment was declined. Your tickets remain reserved until the countdown ends.",
      402,
      { orderId, retryable: true },
    );
  }
  if (status === "TIMED_OUT") {
    throw new ApplicationError(
      "PAYMENT_TIMEOUT",
      "Payment timed out. Check your order before retrying.",
      504,
      { orderId, retryable: true },
    );
  }
  throw new ApplicationError(
    "PAYMENT_FAILED",
    "Payment could not be processed. Try again with a new idempotency key.",
    503,
    { orderId, retryable: true },
  );
}

function toCheckoutResult(order: {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  totalCents: number;
  tickets: Array<{ id: string; ticketNumber: string }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    price: {
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      feeCents: order.feeCents,
      totalCents: order.totalCents,
    },
    tickets: order.tickets,
  };
}
