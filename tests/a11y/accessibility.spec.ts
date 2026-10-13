import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { checkout, reserveSeat } from "../support/api";
import { expect, signIn, test } from "../support/fixtures";
import { database, type Scenario } from "../support/scenario";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .analyze();
  const summary = violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    targets: nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary, `Accessibility violations on ${path}`).toEqual([]);
}

async function issueTicket(page: Page, scenario: Scenario) {
  const reservationId = await reserveSeat(page.request, scenario);
  await expect(await checkout(page.request, reservationId)).toBeOK();
  return database.ticket.findFirstOrThrow({
    where: { userId: scenario.customer.id },
  });
}

test("public pages have no WCAG A or AA violations", async ({
  page,
  scenario,
}) => {
  for (const path of [
    "/",
    "/events",
    `/events/${scenario.event.slug}`,
    "/sign-in",
    "/register",
    "/forgot-password",
  ]) {
    await test.step(path, () => expectNoViolations(page, path));
  }
});

test("customer pages have no WCAG A or AA violations", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.customer.email);
  const ticket = await issueTicket(page, scenario);
  const reservationId = await reserveSeat(page.request, scenario, 1);
  for (const path of [
    `/cart/${reservationId}`,
    "/account",
    "/account/orders",
    `/account/orders/${ticket.orderId}`,
    "/account/tickets",
    `/account/tickets/${ticket.id}`,
  ]) {
    await test.step(path, () => expectNoViolations(page, path));
  }
});

test("organizer pages have no WCAG A or AA violations", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.organizerUser.email);
  for (const path of [
    "/organizer",
    "/organizer/venues",
    "/organizer/events/new",
    `/organizer/events/${scenario.event.id}/edit`,
    "/organizer/orders",
    "/organizer/promotions",
  ]) {
    await test.step(path, () => expectNoViolations(page, path));
  }
});

test("administrator pages have no WCAG A or AA violations", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.administrator.email);
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/events",
    "/admin/refunds",
    "/admin/audit",
  ]) {
    await test.step(path, () => expectNoViolations(page, path));
  }
});
