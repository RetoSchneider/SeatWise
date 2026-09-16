import { describe, expect, it } from "vitest";

import { createEventSchema, venueSchema } from "./organizer-service";

const event = {
  venueId: "venue",
  title: "Test concert",
  summary: "An evening of live music in Zurich.",
  description:
    "An evening of live music with a full band and special guest performers.",
  category: "Music",
  performance: {
    startsAt: "2030-06-01T20:00:00Z",
    salesStartAt: "2030-01-01T00:00:00Z",
    salesEndAt: "2030-06-01T19:00:00Z",
  },
  ticketTypes: [
    {
      sectionId: "floor",
      name: "Standard",
      priceCents: 5000,
      currency: "CHF",
      minPerOrder: 1,
      maxPerOrder: 8,
    },
  ],
};

describe("event validation", () => {
  it("accepts a valid schedule and inventory", () => {
    expect(createEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    { endsAt: "2030-06-01T19:00:00Z" },
    { doorsAt: "2030-06-01T21:00:00Z" },
    { salesEndAt: "2030-06-01T21:00:00Z" },
    { salesStartAt: "2030-06-01T19:00:00Z" },
  ])("rejects an invalid schedule %o", (schedule) => {
    expect(
      createEventSchema.safeParse({
        ...event,
        performance: { ...event.performance, ...schedule },
      }).success,
    ).toBe(false);
  });

  it("rejects repeated sections before creating duplicate inventory", () => {
    expect(
      createEventSchema.safeParse({
        ...event,
        ticketTypes: [
          event.ticketTypes[0],
          { ...event.ticketTypes[0], name: "Duplicate" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid per-order limits", () => {
    expect(
      createEventSchema.safeParse({
        ...event,
        ticketTypes: [
          { ...event.ticketTypes[0], minPerOrder: 4, maxPerOrder: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a timezone that would break event formatting", () => {
    expect(
      venueSchema.shape.timezone.safeParse("Europe/NotACity").success,
    ).toBe(false);
    expect(venueSchema.shape.timezone.safeParse("Europe/Zurich").success).toBe(
      true,
    );
  });
});
