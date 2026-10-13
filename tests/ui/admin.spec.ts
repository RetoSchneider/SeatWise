import { test, expect, signIn } from "../support/fixtures";

test("event moderation shows performance times in the venue timezone", async ({
  page,
  scenario,
}) => {
  const startsAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: scenario.venue.timezone,
  }).format(scenario.performance.startsAt);

  await signIn(page.request, scenario.administrator.email);
  await page.goto("/admin/events");

  const eventRow = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: scenario.event.title }) });
  await expect(eventRow).toContainText(
    `${scenario.venue.name}, ${scenario.venue.city} · ${startsAt}`,
  );
});
