import { test, expect } from "../support/fixtures";
import { database } from "../support/scenario";

test("organizers can create, publish, unpublish, and cancel an event", async ({
  organizer,
  request,
  scenario,
}) => {
  const created = await organizer.post("/api/v1/organizer/events", {
    data: {
      venueId: scenario.venue.id,
      title: "New automation concert",
      summary: "A newly created event for the organizer workflow.",
      description:
        "This event exercises the full organizer lifecycle against real inventory.",
      category: "Music",
      performance: {
        startsAt: scenario.performance.startsAt.toISOString(),
        salesStartAt: scenario.performance.salesStartAt.toISOString(),
        salesEndAt: scenario.performance.salesEndAt.toISOString(),
      },
      ticketTypes: [
        {
          sectionId: scenario.venue.sections[1].id,
          name: "Standard",
          priceCents: 2500,
          currency: "CHF",
          capacity: 6,
        },
      ],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const event = (await created.json()).data;
  expect((await request.get(`/api/v1/events/${event.slug}`)).status()).toBe(
    404,
  );
  for (const action of ["PUBLISH", "UNPUBLISH", "PUBLISH", "CANCEL"]) {
    await expect(
      await organizer.post(`/api/v1/organizer/events/${event.id}/status`, {
        data: { action },
      }),
    ).toBeOK();
    expect((await request.get(`/api/v1/events/${event.slug}`)).status()).toBe(
      action === "PUBLISH" ? 200 : 404,
    );
  }
  expect(
    (
      await organizer.post(`/api/v1/organizer/events/${event.id}/status`, {
        data: { action: "PUBLISH" },
      })
    ).status(),
  ).toBe(409);
  expect(
    await database.performance.findFirstOrThrow({
      where: { eventId: event.id },
    }),
  ).toMatchObject({ status: "CANCELLED" });
});

test("invalid organizer input is rejected before creating records", async ({
  organizer,
  scenario,
}) => {
  const response = await organizer.post("/api/v1/organizer/venues", {
    data: {
      name: "Invalid timezone venue",
      description: scenario.venue.description,
      addressLine1: "Teststrasse 2",
      city: "Zurich",
      region: "Zurich",
      postalCode: "8000",
      countryCode: "CH",
      timezone: "Europe/NotACity",
    },
  });
  expect(response.status()).toBe(422);
  expect(
    await database.venue.count({
      where: { organizerId: scenario.organizer.id },
    }),
  ).toBe(1);
});
