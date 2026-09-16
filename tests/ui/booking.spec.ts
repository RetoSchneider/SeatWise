import { test, expect, signIn } from "../support/fixtures";
import { database, password } from "../support/scenario";
import { reserveSeat } from "../support/api";

test("customer signs in, books a seat, and opens the issued QR ticket", async ({
  page,
  scenario,
}) => {
  await page.goto(`/sign-in?callbackURL=/events/${scenario.event.slug}`);
  await page.getByLabel("Email address").fill(scenario.customer.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/events/${scenario.event.slug}`);
  const seat = page.getByRole("button", { name: /Floor, row A, seat 1,/ });
  await seat.focus();
  await page.keyboard.press("Space");
  await expect(seat).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reserve selection" }).click();
  await expect(page).toHaveURL(/\/cart\//);
  await page
    .getByLabel("Promotion code", { exact: true })
    .fill(scenario.promotion.code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByText(`Promotion (${scenario.promotion.code})`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pay and get tickets" }).click();
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View ticket", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/tickets\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: scenario.event.title }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/i })).toBeVisible();
  const order = await database.order.findFirstOrThrow({
    where: { userId: scenario.customer.id },
    include: { tickets: true },
  });
  expect(order).toMatchObject({ status: "PAID", totalCents: 4463 });
  expect(order.tickets).toHaveLength(1);
});

test("declined payments show an error and can be retried", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.customer.email);
  const id = await reserveSeat(page.request, scenario);
  await page.goto(`/cart/${id}`);
  await page.getByLabel("Declined payment", { exact: true }).check();
  await page.getByRole("button", { name: "Pay and get tickets" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Payment was declined",
  );
  await expect(
    page.getByRole("button", { name: "Pay and get tickets" }),
  ).toBeEnabled();
  await page.getByLabel("Successful payment", { exact: true }).check();
  await page.getByRole("button", { name: "Pay and get tickets" }).click();
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
  expect(
    await database.ticket.count({ where: { userId: scenario.customer.id } }),
  ).toBe(1);
});

test("general admission can be reserved and released", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.customer.email);
  await page.goto(`/events/${scenario.event.slug}`);
  await page
    .getByRole("button", { name: "Add one Standing ticket ticket" })
    .click();
  await page
    .getByRole("button", { name: "Add one Standing ticket ticket" })
    .click();
  await expect(page.getByLabel("Standing ticket quantity")).toHaveText("2");
  await page.getByRole("button", { name: "Reserve selection" }).click();
  await expect(page).toHaveURL(/\/cart\//);
  await page.getByRole("button", { name: "Release tickets" }).click();
  await expect(page).toHaveURL(`/events/${scenario.event.slug}`);
  expect(
    await database.generalAdmissionInventory.findUniqueOrThrow({
      where: { ticketTypeId: scenario.standing.id },
    }),
  ).toMatchObject({ reserved: 0, sold: 0 });
});

test("network failure leaves checkout usable", async ({ page, scenario }) => {
  await signIn(page.request, scenario.customer.email);
  const id = await reserveSeat(page.request, scenario);
  await page.goto(`/cart/${id}`);
  await page.route(
    "**/api/v1/checkout",
    async (route) => {
      await route.fetch();
      await route.abort();
    },
    {
      times: 1,
    },
  );
  await page.getByRole("button", { name: "Pay and get tickets" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "The request could not be completed. Please try again.",
  );
  await expect(
    page.getByRole("button", { name: "Pay and get tickets" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pay and get tickets" }).click();
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
});
