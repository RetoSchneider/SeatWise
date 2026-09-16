import { test, expect } from "../support/fixtures";
import { database } from "../support/scenario";
import { reserveSeat, checkout } from "../support/api";

test("only one customer can reserve the same seat concurrently", async ({
  customer,
  otherCustomer,
  scenario,
}) => {
  const data = {
    performanceId: scenario.performance.id,
    seatInventoryIds: [scenario.assigned.seatInventory[0].id],
  };
  const responses = await Promise.all([
    customer.post("/api/v1/reservations", { data }),
    otherCustomer.post("/api/v1/reservations", { data }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    201, 409,
  ]);
  const winner = responses.find((response) => response.status() === 201)!;
  const reservationId = (await winner.json()).data.id;
  const seat = await database.seatInventory.findUniqueOrThrow({
    where: { id: data.seatInventoryIds[0] },
  });
  expect(seat).toMatchObject({
    state: "RESERVED",
    activeReservationId: reservationId,
  });
  expect(
    await database.reservation.count({
      where: { performanceId: scenario.performance.id },
    }),
  ).toBe(1);
});

test("general admission cannot oversell under concurrent requests", async ({
  customer,
  otherCustomer,
  scenario,
}) => {
  const data = {
    performanceId: scenario.performance.id,
    generalAdmission: [{ ticketTypeId: scenario.standing.id, quantity: 5 }],
  };
  const responses = await Promise.all([
    customer.post("/api/v1/reservations", { data }),
    otherCustomer.post("/api/v1/reservations", { data }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    201, 409,
  ]);
  expect(
    await database.generalAdmissionInventory.findUniqueOrThrow({
      where: { ticketTypeId: scenario.standing.id },
    }),
  ).toMatchObject({ reserved: 5, sold: 0, capacity: 8 });
});

test("release restores inventory and is idempotent", async ({
  customer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await customer.delete(`/api/v1/reservations/${id}`);
    await expect(response).toBeOK();
    expect((await response.json()).data.status).toBe("RELEASED");
  }
  expect(
    await database.seatInventory.findUniqueOrThrow({
      where: { id: scenario.assigned.seatInventory[0].id },
    }),
  ).toMatchObject({
    state: "AVAILABLE",
    activeReservationId: null,
    reservedUntil: null,
  });
});

test("expired reservations release seats and reject checkout", async ({
  customer,
  scenario,
}) => {
  const id = await reserveSeat(customer, scenario);
  await database.reservation.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const response = await customer.get(`/api/v1/reservations/${id}`);
  expect((await response.json()).data.status).toBe("EXPIRED");
  expect((await checkout(customer, id)).status()).toBe(409);
  expect(
    await database.seatInventory.findUniqueOrThrow({
      where: { id: scenario.assigned.seatInventory[0].id },
    }),
  ).toMatchObject({ state: "AVAILABLE", activeReservationId: null });
  expect(await database.order.count({ where: { reservationId: id } })).toBe(0);
});

test("duplicate general admission types cannot bypass per-order limits", async ({
  customer,
  scenario,
}) => {
  await database.ticketType.update({
    where: { id: scenario.standing.id },
    data: { maxPerOrder: 2 },
  });
  const response = await customer.post("/api/v1/reservations", {
    data: {
      performanceId: scenario.performance.id,
      generalAdmission: [
        { ticketTypeId: scenario.standing.id, quantity: 2 },
        { ticketTypeId: scenario.standing.id, quantity: 2 },
      ],
    },
  });
  expect(response.status()).toBe(422);
  expect(
    await database.reservation.count({
      where: { performanceId: scenario.performance.id },
    }),
  ).toBe(0);
});

test("assigned seats enforce ticket type limits", async ({
  customer,
  scenario,
}) => {
  await database.ticketType.update({
    where: { id: scenario.assigned.id },
    data: { maxPerOrder: 1 },
  });
  const response = await customer.post("/api/v1/reservations", {
    data: {
      performanceId: scenario.performance.id,
      seatInventoryIds: scenario.assigned.seatInventory.map((seat) => seat.id),
    },
  });
  expect(response.status()).toBe(409);
  expect(
    await database.seatInventory.count({
      where: { performanceId: scenario.performance.id, state: "AVAILABLE" },
    }),
  ).toBe(2);
});
