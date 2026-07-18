import "dotenv/config";

import { database } from "../src/shared/infrastructure/database";

const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const originHeaders = {
  origin: baseUrl,
  "content-type": "application/json",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function responseJson(response: Response) {
  return (await response.json()) as unknown;
}

async function signIn(email: string) {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({
      email,
      password: "SeatWise!2026",
      rememberMe: true,
    }),
  });
  assert(response.ok, `Sign-in failed for ${email}: ${await response.text()}`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie, `Sign-in did not issue a cookie for ${email}`);
  return cookie;
}

async function api(
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
) {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    headers.set("origin", baseUrl);
  }
  if (options.idempotencyKey) {
    headers.set("idempotency-key", options.idempotencyKey);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { response, payload: await responseJson(response) };
}

function dataOf<T>(payload: unknown): T {
  assert(
    typeof payload === "object" && payload !== null && "data" in payload,
    `Expected API data envelope, received ${JSON.stringify(payload)}`,
  );
  return payload.data as T;
}

async function createSeatReservation(cookie: string, inventoryId: string) {
  const { response, payload } = await api("/api/v1/reservations", {
    method: "POST",
    cookie,
    body: {
      performanceId: "performance_midnight_signals",
      seatInventoryIds: [inventoryId],
      generalAdmission: [],
    },
  });
  assert(
    response.status === 201,
    `Reservation failed: ${JSON.stringify(payload)}`,
  );
  return dataOf<{ id: string }>(payload);
}

async function main() {
  const live = await api("/api/v1/health/live");
  const ready = await api("/api/v1/health/ready");
  assert(live.response.ok && ready.response.ok, "Health checks failed");

  const [customerCookie, organizerCookie, adminCookie] = await Promise.all([
    signIn("customer@seatwise.local"),
    signIn("organizer@seatwise.local"),
    signIn("admin@seatwise.local"),
  ]);

  const eventResponse = await api("/api/v1/events/midnight-signals");
  assert(eventResponse.response.ok, "Published event could not be loaded");

  const forbiddenOrganizer = await api("/api/v1/organizer/dashboard", {
    cookie: customerCookie,
  });
  const forbiddenAdmin = await api("/api/v1/admin/dashboard", {
    cookie: customerCookie,
  });
  assert(
    forbiddenOrganizer.response.status === 403 &&
      forbiddenAdmin.response.status === 403,
    "Vertical authorization check failed",
  );

  const reservation = await createSeatReservation(
    customerCookie,
    "inventory_midnight_seat_floor_a_1",
  );
  const promotion = await api(
    `/api/v1/reservations/${reservation.id}/promotion`,
    {
      method: "POST",
      cookie: customerCookie,
      body: { code: "WELCOME15" },
    },
  );
  assert(
    promotion.response.ok,
    `Promotion failed: ${JSON.stringify(promotion.payload)}`,
  );

  const idempotencyKey = `smoke-success-${Date.now()}`;
  const paid = await api("/api/v1/checkout", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey,
    body: {
      reservationId: reservation.id,
      paymentToken: "pm_success",
    },
  });
  assert(
    paid.response.status === 201,
    `Checkout failed: ${JSON.stringify(paid.payload)}`,
  );
  const paidOrder = dataOf<{ id: string; tickets: Array<{ id: string }> }>(
    paid.payload,
  );
  assert(
    paidOrder.tickets.length === 1,
    "Paid checkout did not issue a ticket",
  );

  const repeated = await api("/api/v1/checkout", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey,
    body: {
      reservationId: reservation.id,
      paymentToken: "pm_decline",
    },
  });
  const repeatedOrder = dataOf<{ id: string }>(repeated.payload);
  assert(
    repeated.response.status === 201 && repeatedOrder.id === paidOrder.id,
    "Repeated idempotency key did not return the original order",
  );
  assert(
    (await database.order.count({
      where: {
        userId: "user_customer_demo",
        idempotencyKey,
      },
    })) === 1,
    "Idempotent checkout created duplicate orders",
  );

  const declinedReservation = await createSeatReservation(
    customerCookie,
    "inventory_midnight_seat_floor_a_2",
  );
  const declined = await api("/api/v1/checkout", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey: `smoke-decline-${Date.now()}`,
    body: {
      reservationId: declinedReservation.id,
      paymentToken: "pm_decline",
    },
  });
  assert(
    declined.response.status === 402,
    "Decline scenario did not return 402",
  );
  const retried = await api("/api/v1/checkout", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey: `smoke-retry-${Date.now()}`,
    body: {
      reservationId: declinedReservation.id,
      paymentToken: "pm_success",
    },
  });
  assert(retried.response.status === 201, "Payment retry did not succeed");

  const expiringReservation = await createSeatReservation(
    customerCookie,
    "inventory_midnight_seat_floor_a_3",
  );
  const expiredAt = new Date(Date.now() - 60_000);
  await database.reservation.update({
    where: { id: expiringReservation.id },
    data: { expiresAt: expiredAt },
  });
  await database.seatInventory.updateMany({
    where: { activeReservationId: expiringReservation.id },
    data: { reservedUntil: expiredAt },
  });
  const expired = await api(`/api/v1/reservations/${expiringReservation.id}`, {
    cookie: customerCookie,
  });
  const expiredData = dataOf<{ status: string }>(expired.payload);
  const releasedInventory = await database.seatInventory.findUniqueOrThrow({
    where: { id: "inventory_midnight_seat_floor_a_3" },
  });
  assert(
    expiredData.status === "EXPIRED" && releasedInventory.state === "AVAILABLE",
    "Reservation expiry did not release inventory",
  );

  for (const [seat, token, expectedStatus] of [
    ["inventory_midnight_seat_floor_a_4", "pm_timeout", 504],
    ["inventory_midnight_seat_floor_a_5", "pm_transient", 503],
  ] as const) {
    const failureReservation = await createSeatReservation(
      customerCookie,
      seat,
    );
    const payment = await api("/api/v1/checkout", {
      method: "POST",
      cookie: customerCookie,
      idempotencyKey: `smoke-${token}-${Date.now()}`,
      body: {
        reservationId: failureReservation.id,
        paymentToken: token,
      },
    });
    assert(
      payment.response.status === expectedStatus,
      `${token} returned ${payment.response.status}, expected ${expectedStatus}`,
    );
  }

  const generalAdmission = await api("/api/v1/reservations", {
    method: "POST",
    cookie: customerCookie,
    body: {
      performanceId: "performance_city_stories",
      seatInventoryIds: [],
      generalAdmission: [
        { ticketTypeId: "ticket_type_stories_ga", quantity: 2 },
      ],
    },
  });
  assert(
    generalAdmission.response.status === 201,
    `GA reservation failed: ${JSON.stringify(generalAdmission.payload)}`,
  );
  const gaReservation = dataOf<{ id: string }>(generalAdmission.payload);
  const gaPaid = await api("/api/v1/checkout", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey: `smoke-ga-${Date.now()}`,
    body: {
      reservationId: gaReservation.id,
      paymentToken: "pm_success",
    },
  });
  const gaOrder = dataOf<{ tickets: Array<{ id: string }> }>(gaPaid.payload);
  assert(
    gaPaid.response.status === 201 && gaOrder.tickets.length === 2,
    "General-admission checkout did not issue the requested tickets",
  );

  const organizer = await api("/api/v1/organizer/dashboard", {
    cookie: organizerCookie,
  });
  const admin = await api("/api/v1/admin/audit", { cookie: adminCookie });
  assert(
    organizer.response.ok && admin.response.ok,
    "Organizer or administrator workflow failed",
  );

  const createdVenue = await api("/api/v1/organizer/venues", {
    method: "POST",
    cookie: organizerCookie,
    body: {
      name: "Smoke Test Room",
      description:
        "A temporary venue created by the repeatable production smoke verification.",
      addressLine1: "1 Verification Way",
      city: "Boston",
      region: "MA",
      postalCode: "02110",
      countryCode: "US",
      timezone: "America/New_York",
    },
  });
  assert(
    createdVenue.response.status === 201,
    "Organizer venue creation failed",
  );

  const editedEvent = await api(
    "/api/v1/organizer/events/event_midnight_signals",
    {
      method: "PATCH",
      cookie: organizerCookie,
      body: {
        title: "Midnight Signals",
        summary:
          "An intimate evening of cinematic electronic music and live visual performance.",
        description:
          "Midnight Signals pairs a six-piece electronic ensemble with responsive projection art created in real time. The production is designed for Harbor Hall, moving from restrained ambient passages to a bright, full-room finale. Doors open an hour before the performance, with accessible entry available from Harbor Avenue.",
        category: "Music",
        refundPolicy: "UNTIL_24_HOURS",
        performance: {
          id: "performance_midnight_signals",
          startsAt: "2030-09-21T00:00:00.000Z",
          doorsAt: "2030-09-20T23:00:00.000Z",
          endsAt: "2030-09-21T02:15:00.000Z",
          salesStartAt: "2026-01-01T00:00:00.000Z",
          salesEndAt: "2030-09-20T22:00:00.000Z",
          reservationDurationMinutes: 10,
        },
        ticketTypes: [
          {
            id: "ticket_type_floor",
            name: "Main Floor",
            description: "Assigned seating on the main floor",
            priceCents: 6800,
            minPerOrder: 1,
            maxPerOrder: 8,
            capacity: null,
          },
          {
            id: "ticket_type_balcony",
            name: "Balcony",
            description: "Assigned seating with an elevated view",
            priceCents: 4400,
            minPerOrder: 1,
            maxPerOrder: 8,
            capacity: null,
          },
        ],
      },
    },
  );
  assert(editedEvent.response.ok, "Organizer event editing failed");
  for (const action of ["UNPUBLISH", "PUBLISH"] as const) {
    const status = await api(
      "/api/v1/organizer/events/event_midnight_signals/status",
      {
        method: "POST",
        cookie: organizerCookie,
        body: { action },
      },
    );
    assert(status.response.ok, `Organizer event ${action} failed`);
  }

  const requestedRefund = await api(`/api/v1/orders/${paidOrder.id}/refunds`, {
    method: "POST",
    cookie: customerCookie,
    body: {
      reason: "Production smoke verification of the refund workflow.",
    },
  });
  assert(requestedRefund.response.status === 201, "Refund request failed");
  const refundRequest = dataOf<{ id: string }>(requestedRefund.payload);
  const processedRefund = await api(
    `/api/v1/organizer/refunds/${refundRequest.id}`,
    {
      method: "POST",
      cookie: organizerCookie,
      body: { decision: "APPROVE" },
    },
  );
  assert(processedRefund.response.ok, "Organizer refund processing failed");

  const horizontalAccess = await api(`/api/v1/orders/${paidOrder.id}`, {
    cookie: organizerCookie,
  });
  assert(
    horizontalAccess.response.status === 404,
    "Order ownership check exposed another user's order",
  );

  const ticketWallet = await api("/api/v1/tickets", {
    cookie: customerCookie,
  });
  const tickets = dataOf<Array<{ id: string }>>(ticketWallet.payload);
  assert(tickets.length >= 4, "Ticket wallet did not include completed orders");

  const sentNotifications = await database.notification.count({
    where: {
      userId: "user_customer_demo",
      type: "ORDER_CONFIRMATION",
      status: "SENT",
    },
  });
  assert(sentNotifications >= 3, "Order emails were not delivered to Mailpit");

  console.info(
    "Smoke check passed: health, all roles, authorization, assigned and GA inventory, promotion, idempotency, all payment outcomes, retry, expiry, organizer management, refund processing, tickets, and email.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
