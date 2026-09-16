import { test, expect } from "../support/fixtures";
import { database } from "../support/scenario";

test("catalog sorts by date before pagination", async ({
  request,
  scenario,
}) => {
  const earlier = await database.event.create({
    data: {
      organizerId: scenario.organizer.id,
      venueId: scenario.venue.id,
      slug: `earlier-${scenario.id}`,
      title: "Earlier concert",
      summary: scenario.event.summary,
      description: scenario.event.description,
      category: scenario.event.category,
      status: "PUBLISHED",
      performances: {
        create: {
          startsAt: new Date(Date.now() + 10 * 86_400_000),
          salesStartAt: scenario.performance.salesStartAt,
          salesEndAt: new Date(Date.now() + 9 * 86_400_000),
        },
      },
    },
  });
  const first = await request.get("/api/v1/events", {
    params: {
      category: scenario.event.category,
      sort: "date",
      pageSize: 1,
      page: 1,
    },
  });
  await expect(first).toBeOK();
  expect(
    (await first.json()).data.map((event: { id: string }) => event.id),
  ).toEqual([earlier.id]);
  const second = await request.get("/api/v1/events", {
    params: {
      category: scenario.event.category,
      sort: "date",
      pageSize: 1,
      page: 2,
    },
  });
  expect(
    (await second.json()).data.map((event: { id: string }) => event.id),
  ).toEqual([scenario.event.id]);
});

test("malformed and invalid requests return structured errors", async ({
  customer,
  request,
}) => {
  const malformed = await customer.post("/api/v1/reservations", {
    headers: { "content-type": "application/json" },
    data: Buffer.from("{"),
  });
  expect(malformed.status()).toBe(400);
  const invalid = await request.get("/api/v1/events?pageSize=1000");
  expect(invalid.status()).toBe(422);
  const body = await invalid.json();
  expect(body.error).toMatchObject({
    code: "VALIDATION_ERROR",
    requestId: expect.any(String),
  });
  expect(invalid.headers()["x-request-id"]).toBe(body.error.requestId);
});
