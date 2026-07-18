import { notFound } from "@/shared/domain/errors";
import { database } from "@/shared/infrastructure/database";

export async function listCustomerOrders(userId: string) {
  return database.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      performance: {
        select: {
          startsAt: true,
          event: {
            select: { title: true, slug: true },
          },
        },
      },
      _count: { select: { tickets: true } },
    },
  });
}

export async function getCustomerOrder(orderId: string, userId: string) {
  const order = await database.order.findFirst({
    where: { id: orderId, userId },
    include: {
      lines: true,
      paymentAttempts: {
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          status: true,
          failureCode: true,
          createdAt: true,
          completedAt: true,
        },
      },
      tickets: { select: { id: true, ticketNumber: true, status: true } },
      performance: {
        include: { event: { include: { venue: true } } },
      },
      refundRequests: true,
    },
  });
  if (!order) {
    throw notFound("Order not found");
  }
  return order;
}

export async function listCustomerTickets(userId: string) {
  return database.ticket.findMany({
    where: { userId },
    orderBy: { performance: { startsAt: "asc" } },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      performance: {
        select: {
          startsAt: true,
          doorsAt: true,
          event: {
            select: {
              title: true,
              venue: { select: { name: true, city: true } },
            },
          },
        },
      },
      seat: {
        select: {
          label: true,
          row: {
            select: {
              label: true,
              section: { select: { name: true } },
            },
          },
        },
      },
      orderLine: { select: { description: true } },
    },
  });
}

export async function getCustomerTicket(ticketId: string, userId: string) {
  const ticket = await database.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      performance: {
        include: { event: { include: { venue: true } } },
      },
      orderLine: true,
      seat: { include: { row: { include: { section: true } } } },
    },
  });
  if (!ticket) {
    throw notFound("Ticket not found");
  }
  return ticket;
}
