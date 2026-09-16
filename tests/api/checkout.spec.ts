import { randomUUID } from "node:crypto";

import { test, expect } from "../support/fixtures";
import { database } from "../support/scenario";
import { checkout, reserveSeat } from "../support/api";

test("an idempotency key cannot change payment parameters", async ({
  customer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  const key = randomUUID();
  expect((await checkout(customer, id, "pm_decline", key)).status()).toBe(402);
  expect((await checkout(customer, id, "pm_success", key)).status()).toBe(409);
  expect(
    await database.ticket.count({ where: { userId: scenario.customer.id } }),
  ).toBe(0);
});

test("checkout issues one ticket and replays the same order", async ({
  customer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  const key = randomUUID();
  const first = await checkout(customer, id, "pm_success", key);
  expect(first.status(), await first.text()).toBe(201);
  const order = (await first.json()).data;
  const replay = await checkout(customer, id, "pm_success", key);
  expect(replay.status()).toBe(201);
  expect((await replay.json()).data.id).toBe(order.id);
  const persisted = await database.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { tickets: true, paymentAttempts: true, reservation: true },
  });
  expect(persisted).toMatchObject({
    status: "PAID",
    subtotalCents: 5000,
    feeCents: 250,
    totalCents: 5250,
    currency: "CHF",
    reservation: { status: "CHECKED_OUT" },
  });
  expect(persisted.tickets).toHaveLength(1);
  expect(persisted.paymentAttempts).toHaveLength(1);
  expect(persisted.paymentAttempts[0].status).toBe("SUCCEEDED");
  expect(
    await database.seatInventory.findUniqueOrThrow({
      where: { id: scenario.assigned.seatInventory[0].id },
    }),
  ).toMatchObject({ state: "SOLD", activeReservationId: null });
});

for (const [token, status, httpStatus] of [
  ["pm_decline", "DECLINED", 402],
  ["pm_timeout", "TIMED_OUT", 504],
  ["pm_transient", "FAILED", 503],
] as const) {
  test(`${token} keeps the reservation available for a successful retry`, async ({
    customer,
    scenario,
  }) => {
    const id = await reserveSeat(customer, scenario);
    const failed = await checkout(customer, id, token);
    expect(failed.status(), await failed.text()).toBe(httpStatus);
    const order = await database.order.findFirstOrThrow({
      where: { reservationId: id },
      include: { tickets: true, paymentAttempts: true, reservation: true },
    });
    expect(order).toMatchObject({
      status: "PAYMENT_FAILED",
      reservation: { status: "ACTIVE" },
    });
    expect(order.tickets).toHaveLength(0);
    expect(order.paymentAttempts[0].status).toBe(status);
    expect((await checkout(customer, id)).status()).toBe(201);
    expect(
      await database.ticket.count({ where: { userId: scenario.customer.id } }),
    ).toBe(1);
  });
}

test("an idempotency key cannot be reused for a different reservation", async ({
  customer,
  scenario,
}) => {
  const first = await reserveSeat(customer, scenario);
  const second = await reserveSeat(customer, scenario, 1);
  const key = randomUUID();
  expect((await checkout(customer, first, "pm_success", key)).status()).toBe(
    201,
  );
  expect((await checkout(customer, second, "pm_success", key)).status()).toBe(
    409,
  );
  expect(
    await database.reservation.findUniqueOrThrow({ where: { id: second } }),
  ).toMatchObject({ status: "ACTIVE" });
});

test("cancelled events cannot be purchased using an existing reservation", async ({
  customer,
  organizer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  await expect(
    await organizer.post(
      `/api/v1/organizer/events/${scenario.event.id}/status`,
      { data: { action: "CANCEL" } },
    ),
  ).toBeOK();
  expect((await checkout(customer, id)).status()).toBe(409);
  expect(await database.order.count({ where: { reservationId: id } })).toBe(0);
});

test("promotion totals persist and the redemption limit cannot be exceeded", async ({
  customer,
  otherCustomer,
  scenario,
}) => {
  const first = await reserveSeat(customer, scenario);
  const second = await reserveSeat(otherCustomer, scenario, 1);
  for (const [request, id] of [
    [customer, first],
    [otherCustomer, second],
  ] as const) {
    const response = await request.post(
      `/api/v1/reservations/${id}/promotion`,
      { data: { code: scenario.promotion.code } },
    );
    await expect(response).toBeOK();
    expect((await response.json()).data.price).toMatchObject({
      subtotalCents: 5000,
      discountCents: 750,
      feeCents: 213,
      totalCents: 4463,
    });
  }
  const responses = await Promise.all([
    checkout(customer, first),
    checkout(otherCustomer, second),
  ]);
  expect(
    responses.filter((response) => response.status() === 201),
  ).toHaveLength(1);
  expect(
    responses.filter((response) => [409, 422].includes(response.status())),
  ).toHaveLength(1);
  expect(
    await database.promotionRedemption.count({
      where: { promotionCodeId: scenario.promotion.id },
    }),
  ).toBe(1);
});
