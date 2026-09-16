import { test, expect } from "../support/fixtures";
import { reserveSeat, checkout } from "../support/api";
import { database } from "../support/scenario";

test("reservation rate limits reject excess requests without creating inventory holds", async ({
  customer,
  scenario,
}) => {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await customer.post("/api/v1/reservations", { data: {} });
    statuses.push(response.status());
  }
  expect(statuses).toContain(429);
  expect(statuses.every((status) => [422, 429].includes(status))).toBe(true);
  expect(
    await database.reservation.count({
      where: { userId: scenario.customer.id },
    }),
  ).toBe(0);
});

test("protected resources require authentication and enforce roles", async ({
  request,
  customer,
}) => {
  for (const path of [
    "orders",
    "tickets",
    "organizer/dashboard",
    "admin/dashboard",
  ]) {
    const response = await request.get(`/api/v1/${path}`);
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("AUTHENTICATION_REQUIRED");
  }
  for (const path of ["organizer/dashboard", "admin/users", "admin/refunds"]) {
    expect((await customer.get(`/api/v1/${path}`)).status()).toBe(403);
  }
});

test("customers cannot access or mutate another customer's resources", async ({
  customer,
  otherCustomer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  expect((await otherCustomer.get(`/api/v1/reservations/${id}`)).status()).toBe(
    404,
  );
  expect(
    (await otherCustomer.delete(`/api/v1/reservations/${id}`)).status(),
  ).toBe(404);
  expect(
    (
      await otherCustomer.post(`/api/v1/reservations/${id}/promotion`, {
        data: { code: scenario.promotion.code },
      })
    ).status(),
  ).toBe(404);
  const response = await checkout(customer, id);
  expect(response.status()).toBe(201);
  const order = (await response.json()).data;
  expect((await otherCustomer.get(`/api/v1/orders/${order.id}`)).status()).toBe(
    404,
  );
  expect(
    (
      await otherCustomer.get(`/api/v1/tickets/${order.tickets[0].id}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await otherCustomer.post(`/api/v1/orders/${order.id}/refunds`, {
        data: { reason: "I cannot attend this event" },
      })
    ).status(),
  ).toBe(404);
});

test("cross-origin mutations fail without changing inventory", async ({
  customer,
  scenario,
}) => {
  const response = await customer.post("/api/v1/reservations", {
    headers: { origin: "https://untrusted.example" },
    data: {
      performanceId: scenario.performance.id,
      seatInventoryIds: [scenario.assigned.seatInventory[0].id],
    },
  });
  expect(response.status()).toBe(403);
  expect(
    await database.reservation.count({
      where: { performanceId: scenario.performance.id },
    }),
  ).toBe(0);
});

test("role changes take effect on an existing session", async ({
  administrator,
  organizer,
  scenario,
}) => {
  await expect(await organizer.get("/api/v1/organizer/dashboard")).toBeOK();
  const changed = await administrator.patch(
    `/api/v1/admin/users/${scenario.organizerUser.id}/role`,
    { data: { role: "CUSTOMER" } },
  );
  await expect(changed).toBeOK();
  expect((await organizer.get("/api/v1/organizer/dashboard")).status()).toBe(
    403,
  );
});

test("suspended organizers lose access", async ({
  administrator,
  organizer,
  scenario,
}) => {
  await expect(
    await administrator.patch(
      `/api/v1/admin/organizers/${scenario.organizer.id}/status`,
      { data: { status: "SUSPENDED" } },
    ),
  ).toBeOK();
  expect((await organizer.get("/api/v1/organizer/dashboard")).status()).toBe(
    403,
  );
});
