import { test, expect, signIn } from "../support/fixtures";
import { database } from "../support/scenario";

test("venue creation saves the venue and resets the form", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.organizerUser.email);
  await page.goto("/organizer/venues");
  const name = `New venue ${scenario.id}`;
  await page.getByLabel("Venue name", { exact: true }).fill(name);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A new venue created through the organizer interface.");
  await page.getByLabel("Street address").fill("Teststrasse 2");
  await page.getByLabel("City", { exact: true }).fill("Zurich");
  await page.getByLabel("State or region").fill("Zurich");
  await page.getByLabel("Postal code").fill("8000");
  await page.getByRole("button", { name: "Create venue", exact: true }).click();
  await expect(page.getByLabel("Venue name", { exact: true })).toHaveValue("");
  await expect(page.getByRole("option", { name, exact: true })).toBeAttached();
  expect(
    await database.venue.count({
      where: { organizerId: scenario.organizer.id, name },
    }),
  ).toBe(1);
});
