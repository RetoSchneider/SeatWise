import { z } from "zod";

import type { Clock } from "@/shared/domain/clock";
import { systemClock } from "@/shared/domain/clock";
import { conflict, forbidden, notFound } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import { notificationService } from "@/modules/notifications/notification-service";
import {
  localPaymentProvider,
  type PaymentProvider,
} from "@/modules/payments/payment-provider";

export const refundRequestSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const processRefundSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

export async function requestRefund(
  orderId: string,
  userId: string,
  reason: string,
  clock: Clock = systemClock,
) {
  const now = clock.now();
  const order = await database.order.findFirst({
    where: { id: orderId, userId },
    include: {
      performance: { include: { event: true } },
      refunds: { where: { status: "SUCCEEDED" } },
      refundRequests: {
        where: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
      },
    },
  });
  if (!order) {
    throw notFound("Order not found");
  }
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) {
    throw conflict("CONFLICT", "This order is not eligible for a refund");
  }
  if (order.refundRequests.length > 0) {
    throw conflict("CONFLICT", "A refund request is already in progress");
  }

  const cutoffHours =
    order.performance.event.refundPolicy === "UNTIL_7_DAYS" ? 168 : 24;
  const cutoff = new Date(
    order.performance.startsAt.getTime() - cutoffHours * 60 * 60 * 1_000,
  );
  if (
    order.performance.event.refundPolicy === "NON_REFUNDABLE" ||
    now >= cutoff
  ) {
    throw conflict("CONFLICT", "The refund window for this order has closed");
  }

  const alreadyRefunded = order.refunds.reduce(
    (total, refund) => total + refund.amountCents,
    0,
  );
  const amount = order.totalCents - alreadyRefunded;
  const request = await database.refundRequest.create({
    data: {
      orderId: order.id,
      userId,
      reason,
      requestedAmountCents: amount,
    },
  });
  await recordAuditEvent({
    actorUserId: userId,
    action: "REFUND_REQUESTED",
    entityType: "RefundRequest",
    entityId: request.id,
    metadata: { orderId: order.id, amountCents: amount },
  });
  return request;
}

export async function processRefund(
  refundRequestId: string,
  actor: { id: string; role: "ORGANIZER" | "ADMINISTRATOR" },
  decision: "APPROVE" | "REJECT",
  dependencies: {
    clock?: Clock;
    paymentProvider?: PaymentProvider;
  } = {},
) {
  const clock = dependencies.clock ?? systemClock;
  const paymentProvider = dependencies.paymentProvider ?? localPaymentProvider;
  const refundRequest = await database.refundRequest.findUnique({
    where: { id: refundRequestId },
    include: {
      order: {
        include: {
          organizer: true,
          user: true,
          paymentAttempts: {
            where: { status: "SUCCEEDED" },
            orderBy: { completedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!refundRequest) {
    throw notFound("Refund request not found");
  }
  if (
    actor.role === "ORGANIZER" &&
    refundRequest.order.organizer.userId !== actor.id
  ) {
    throw forbidden();
  }
  if (refundRequest.status !== "REQUESTED") {
    throw conflict("CONFLICT", "This refund request has already been reviewed");
  }

  if (decision === "REJECT") {
    const rejected = await database.refundRequest.update({
      where: { id: refundRequest.id },
      data: {
        status: "REJECTED",
        reviewedById: actor.id,
        resolvedAt: clock.now(),
      },
    });
    await recordAuditEvent({
      actorUserId: actor.id,
      action: "REFUND_REJECTED",
      entityType: "RefundRequest",
      entityId: refundRequest.id,
      metadata: { orderId: refundRequest.orderId },
    });
    return rejected;
  }

  const paymentAttempt = refundRequest.order.paymentAttempts[0];
  if (!paymentAttempt?.providerReference) {
    throw conflict("PAYMENT_FAILED", "No completed payment could be refunded");
  }

  const claimed = await database.refundRequest.updateMany({
    where: { id: refundRequest.id, status: "REQUESTED" },
    data: {
      status: "PROCESSING",
      reviewedById: actor.id,
    },
  });
  if (claimed.count !== 1) {
    throw conflict("CONFLICT", "This refund request has already been reviewed");
  }

  const refundIdempotencyKey = `refund:${refundRequest.id}`;
  const outcome = await paymentProvider.refund({
    amountCents: refundRequest.requestedAmountCents,
    currency: refundRequest.order.currency,
    paymentReference: paymentAttempt.providerReference,
    idempotencyKey: refundIdempotencyKey,
  });

  if (outcome.status !== "SUCCEEDED") {
    await database.refundRequest.update({
      where: { id: refundRequest.id },
      data: { status: "FAILED", resolvedAt: clock.now() },
    });
    throw conflict("PAYMENT_FAILED", "The payment refund failed");
  }

  const completed = await database.$transaction(
    async (client) => {
      const order = await client.order.findUniqueOrThrow({
        where: { id: refundRequest.orderId },
        include: {
          lines: {
            include: {
              reservationItem: true,
              seatInventory: true,
            },
          },
        },
      });
      const refund = await client.refund.create({
        data: {
          orderId: order.id,
          refundRequestId: refundRequest.id,
          paymentAttemptId: paymentAttempt.id,
          providerReference: outcome.providerReference,
          amountCents: refundRequest.requestedAmountCents,
          status: "SUCCEEDED",
          completedAt: clock.now(),
        },
      });

      for (const line of order.lines) {
        if (line.reservationItem.seatInventoryId) {
          await client.seatInventory.updateMany({
            where: {
              soldOrderLineId: line.id,
              state: "SOLD",
            },
            data: {
              state: "AVAILABLE",
              soldOrderLineId: null,
              version: { increment: 1 },
            },
          });
        } else {
          await client.generalAdmissionInventory.update({
            where: { ticketTypeId: line.ticketTypeId },
            data: {
              sold: { decrement: line.quantity },
              version: { increment: 1 },
            },
          });
        }
      }

      await client.ticket.updateMany({
        where: { orderId: order.id },
        data: { status: "REFUNDED" },
      });
      await client.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
      await client.refundRequest.update({
        where: { id: refundRequest.id },
        data: {
          status: "SUCCEEDED",
          processedAmountCents: refundRequest.requestedAmountCents,
          resolvedAt: clock.now(),
        },
      });
      await recordAuditEvent(
        {
          actorUserId: actor.id,
          action: "REFUND_COMPLETED",
          entityType: "Refund",
          entityId: refund.id,
          metadata: {
            orderId: order.id,
            amountCents: refund.amountCents,
          },
        },
        client,
      );
      return refund;
    },
    { isolationLevel: "Serializable" },
  );

  await notificationService.sendEmail({
    userId: refundRequest.order.userId,
    recipient: refundRequest.order.user.email,
    type: "REFUND_COMPLETED",
    subject: `Refund completed for ${refundRequest.order.orderNumber}`,
    body: `Your refund of ${refundRequest.order.currency} ${(refundRequest.requestedAmountCents / 100).toFixed(2)} has been completed.`,
  });
  return completed;
}
