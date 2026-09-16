import { test, expect } from "../support/fixtures";
import { checkout, reserveSeat } from "../support/api";
import { database } from "../support/scenario";

test("approved refunds invalidate tickets and restore inventory once", async ({
  customer,
  organizer,
  scenario,
}) => {
  const reservationId = await reserveSeat(customer, scenario);
  const paid = await checkout(customer, reservationId);
  expect(paid.status()).toBe(201);
  const order = (await paid.json()).data;
  const requested = await customer.post(`/api/v1/orders/${order.id}/refunds`, {
    data: { reason: "My travel plans have changed" },
  });
  expect(requested.status()).toBe(201);
  const refundId = (await requested.json()).data.id;
  const approved = await organizer.post(
    `/api/v1/organizer/refunds/${refundId}`,
    { data: { decision: "APPROVE" } },
  );
  await expect(approved).toBeOK();
  expect(
    (
      await organizer.post(`/api/v1/organizer/refunds/${refundId}`, {
        data: { decision: "APPROVE" },
      })
    ).status(),
  ).toBe(409);
  expect(
    await database.order.findUniqueOrThrow({ where: { id: order.id } }),
  ).toMatchObject({ status: "REFUNDED" });
  expect(
    await database.ticket.findFirstOrThrow({ where: { orderId: order.id } }),
  ).toMatchObject({ status: "REFUNDED" });
  expect(await database.refund.count({ where: { orderId: order.id } })).toBe(1);
  expect(
    await database.seatInventory.findUniqueOrThrow({
      where: { id: scenario.assigned.seatInventory[0].id },
    }),
  ).toMatchObject({ state: "AVAILABLE", soldOrderLineId: null });
});

test("concurrent refund requests create only one active request", async ({
  customer,
  scenario,
}) => {
  const paid = await checkout(customer, await reserveSeat(customer, scenario));
  expect(paid.status()).toBe(201);
  const orderId = (await paid.json()).data.id;
  const responses = await Promise.all(
    Array.from({ length: 2 }, () =>
      customer.post(`/api/v1/orders/${orderId}/refunds`, {
        data: { reason: "I can no longer attend the event" },
      }),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    201, 409,
  ]);
  expect(await database.refundRequest.count({ where: { orderId } })).toBe(1);
});

test("approve and reject cannot both win a refund review", async ({
  customer,
  organizer,
  administrator,
  scenario,
}) => {
  const paid = await checkout(customer, await reserveSeat(customer, scenario));
  const orderId = (await paid.json()).data.id;
  const requested = await customer.post(`/api/v1/orders/${orderId}/refunds`, {
    data: { reason: "I can no longer attend the event" },
  });
  const id = (await requested.json()).data.id;
  const responses = await Promise.all([
    organizer.post(`/api/v1/organizer/refunds/${id}`, {
      data: { decision: "APPROVE" },
    }),
    administrator.post(`/api/v1/admin/refunds/${id}`, {
      data: { decision: "REJECT" },
    }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);
  const request = await database.refundRequest.findUniqueOrThrow({
    where: { id },
  });
  const order = await database.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { refunds: true, tickets: true },
  });
  if (request.status === "SUCCEEDED") {
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds).toHaveLength(1);
    expect(order.tickets[0].status).toBe("REFUNDED");
  } else {
    expect(request.status).toBe("REJECTED");
    expect(order.status).toBe("PAID");
    expect(order.refunds).toHaveLength(0);
    expect(order.tickets[0].status).toBe("VALID");
  }
});
