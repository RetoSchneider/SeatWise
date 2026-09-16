import { test, expect, signIn } from "../support/fixtures";

test("sign-out clears the session and returns to the public home page", async ({
  page,
  scenario,
}) => {
  await signIn(page.request, scenario.customer.email);
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/orders")).status()).toBe(401);
});

test("catalog searches an event and displays an empty result", async ({
  page,
  scenario,
}) => {
  await page.goto("/events");
  await page
    .getByRole("searchbox", { name: "Search events" })
    .fill(scenario.event.title);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: scenario.event.title }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search events" })
    .fill(`missing-${scenario.id}`);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching events" }),
  ).toBeVisible();
});

test("language changes persist after reloading", async ({ page }) => {
  await page.goto("/events");
  await page
    .getByRole("combobox", { name: "Change language" })
    .selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
    "Find your next event",
  );
});

test("invalid credentials show an error without starting a session", async ({
  page,
  scenario,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(scenario.customer.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Incorrect!Password2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Email or password is incorrect.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  expect((await page.request.get("/api/v1/orders")).status()).toBe(401);
});
