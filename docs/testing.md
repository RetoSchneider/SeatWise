# Testing guide

SeatWise is tested at two levels. Vitest covers small, deterministic rules such as prices, payment simulator outcomes and date formatting. Playwright covers everything that crosses the HTTP boundary: API calls, browser flows and accessibility. Playwright runs against the production build and a real PostgreSQL database. Business API responses are never mocked; payment outcomes come from the app's own simulator.

## Risks and coverage

| Risk                                            | How it is verified                                                                              | Tests                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Overselling assigned seats or general admission | Concurrent API requests, exactly one winner, inventory counts checked in the database           | [reservations](../tests/api/reservations.spec.ts)                                                                                     |
| Duplicate charges or tickets                    | Idempotency replay, reused key with different input, retry after a lost response in the browser | [checkout](../tests/api/checkout.spec.ts), [booking](../tests/ui/booking.spec.ts)                                                     |
| Payment failures                                | Declined, timed-out and transient payments, then a successful retry                             | [checkout](../tests/api/checkout.spec.ts), [booking](../tests/ui/booking.spec.ts)                                                     |
| Invalid reservations                            | Duplicate ticket types, per-type limits, expiry, repeated release                               | [reservations](../tests/api/reservations.spec.ts)                                                                                     |
| Promotion overuse                               | Concurrent checkouts, exact totals and redemption count                                         | [checkout](../tests/api/checkout.spec.ts)                                                                                             |
| Unauthorized access                             | Anonymous requests, roles, ownership, role changes, suspension, cross-origin writes             | [authorization](../tests/api/authorization.spec.ts)                                                                                   |
| Refund races                                    | Concurrent requests, competing reviews, one refund, restored inventory, invalidated tickets     | [refunds](../tests/api/refunds.spec.ts)                                                                                               |
| Catalog errors                                  | Sorting before pagination, search, empty results                                                | [catalog](../tests/api/catalog.spec.ts), [discovery](../tests/ui/discovery.spec.ts)                                                   |
| Organizer workflows                             | Event lifecycle, invalid input, venue creation, times shown in the venue timezone               | [organizer API](../tests/api/organizer.spec.ts), [organizer UI](../tests/ui/organizer.spec.ts), [admin UI](../tests/ui/admin.spec.ts) |
| Accessibility                                   | axe-core scan of 23 pages for every role against WCAG 2.2 A and AA rules                        | [accessibility](../tests/a11y/accessibility.spec.ts)                                                                                  |
| Browser regressions                             | Keyboard seat selection, QR ticket, failed login, language persistence, uncaught browser errors | [booking](../tests/ui/booking.spec.ts), [discovery](../tests/ui/discovery.spec.ts)                                                    |
| Input errors                                    | Malformed JSON, structured validation errors, request IDs, reservation rate limits              | [catalog](../tests/api/catalog.spec.ts), [authorization](../tests/api/authorization.spec.ts)                                          |

Unit tests next to the source cover price calculations, simulator outcomes, safe sign-in callback URLs, event schedule rules, ticket limits, timezone validation, transaction conflict handling and date formatting across daylight saving changes.

## Playwright projects

| Project         | Files                     | Browser                 |
| --------------- | ------------------------- | ----------------------- |
| `api`           | `tests/api/**/*.spec.ts`  | none, HTTP only         |
| `chromium`      | `tests/ui/**/*.spec.ts`   | Desktop Chrome          |
| `firefox`       | `tests/ui/**/*.spec.ts`   | Desktop Firefox         |
| `webkit`        | `tests/ui/**/*.spec.ts`   | Desktop Safari          |
| `accessibility` | `tests/a11y/**/*.spec.ts` | Desktop Chrome with axe |

A new UI test therefore runs three times. Every run builds and starts the production app on port 3100 and waits for `/api/v1/health/ready`. Tests never run against the development server, because its on-demand compilation and hot reload made earlier runs flaky.

The runner uses two workers, a 45-second test timeout and a 10-second assertion timeout. Local runs have no retries. CI allows one retry so that a flaky test shows up as flaky in the report instead of failing the build; a test that only passes on retry still needs a fix.

## Test data and isolation

Each test gets its own customer, second customer, organizer, administrator, venue, event, seats, standing tickets and promotion from the `scenario` fixture, and teardown deletes them again. Tests do not depend on seeded demo accounts or on each other.

Role fixtures sign in through the real Better Auth API. Each API context sends a different `x-forwarded-for` header so rate limits treat them as separate clients. The app trusts this header, so a deployed reverse proxy must overwrite it. Database writes in test support only create fixtures and move expiry times; assertions then check the stored orders, payments, tickets, refunds, promotions and inventory.

| Service         | Demo                    | Tests                    |
| --------------- | ----------------------- | ------------------------ |
| App             | `http://localhost:3000` | `http://localhost:3100`  |
| PostgreSQL port | `5432`                  | `55432`                  |
| Database        | `seatwise`              | `seatwise_test`          |
| Mailpit         | `http://localhost:8025` | `http://localhost:18025` |
| Next.js output  | `.next`                 | `.next/playwright`       |

The test database lives in memory (`tmpfs`) and disappears with `pnpm test:db:down`. A guard in [environment.ts](../tests/support/environment.ts) refuses any database that is not a local one named `seatwise_test`, and tests ignore the database credentials in `.env`. The test server runs in UTC while the browsers use Europe/Zurich, so a date formatted in the wrong timezone causes a visible hydration error.

The files that control the suite:

| File                                                                    | Responsibility                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| [playwright.config.ts](../playwright.config.ts)                         | Projects, browsers, server start, timeouts, retries, reports |
| [tests/support/environment.ts](../tests/support/environment.ts)         | Test environment and database guard                          |
| [tests/support/fixtures.ts](../tests/support/fixtures.ts)               | Scenario lifecycle, signed-in API clients, browser errors    |
| [tests/support/scenario.ts](../tests/support/scenario.ts)               | Creates and removes each test's records                      |
| [tests/support/api.ts](../tests/support/api.ts)                         | Reservation and checkout helpers                             |
| [compose.test.yaml](../compose.test.yaml)                               | PostgreSQL and Mailpit for tests                             |
| [scripts/prepare-test-database.ts](../scripts/prepare-test-database.ts) | Applies migrations to the test database                      |

## Run the tests

First time:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm test:db:up
pnpm test:db:prepare
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:e2e
```

On Linux, add `--with-deps` to the browser install. Later sessions only need `pnpm test:db:up`, `pnpm test:db:prepare` and the test commands. Stop the services with `pnpm test:db:down`; the next session needs `pnpm test:db:prepare` again.

| Command                                                                  | Runs                                    |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `pnpm test`                                                              | Vitest unit tests, no database needed   |
| `pnpm test:api`                                                          | API tests                               |
| `pnpm exec playwright test --project=chromium`                           | UI tests in Chromium                    |
| `pnpm exec playwright test --project=accessibility`                      | Accessibility scan                      |
| `pnpm exec playwright test tests/api/reservations.spec.ts --project=api` | Concurrency, limits, expiry and release |
| `pnpm exec playwright test --list`                                       | Lists tests without starting the app    |

## Debug a failure

```bash
pnpm test:e2e:ui
pnpm exec playwright test tests/ui/booking.spec.ts --project=chromium --headed
pnpm exec playwright test --project=chromium --grep "declined payments" --debug
pnpm test:report
```

Close UI mode before starting another run, because both need port 3100. Restart it after changing application code so the app is rebuilt; changes to test files can be rerun directly.

Failed browser tests keep a screenshot, video and trace in `test-results/`. Open the trace from the HTML report, or with `pnpm exec playwright show-trace <path to trace.zip>`. JUnit results are written to `test-results/results.xml`. First decide whether the failure is in setup (database or browser not available) or an assertion (unexpected app behavior). The browser-error check can fail after the visible flow has finished, for example when React reports a hydration mismatch.

To check that a fix is stable:

```bash
pnpm exec playwright test --project=chromium --grep "declined payments" --repeat-each=5 --retries=0
```

## CI

The [Quality workflow](../.github/workflows/quality.yml) runs on every pull request and every push to `master` on Ubuntu. It installs dependencies, starts the test services, runs `pnpm check` and then all Playwright projects. It fails on a committed `test.only`. The HTML report and failure evidence are uploaded as the `playwright-results` artifact for seven days. On `master`, the HTML report is also published to [GitHub Pages](https://retoschneider.github.io/SeatWise/).

## Add a test

Put business rules, permissions and database state in `tests/api`, user interactions in `tests/ui` and page scans in `tests/a11y`. Name the file `*.spec.ts` and import `test` and `expect` from `../support/fixtures` so isolation and the browser-error check apply.

| Fixture                      | Use                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| `scenario`                   | Unique users, event, venue, seats, ticket types and promotion  |
| `request`                    | Unauthenticated API context                                    |
| `customer`, `otherCustomer`  | Separate signed-in customer API contexts                       |
| `organizer`, `administrator` | Signed-in API contexts for role-specific behavior              |
| `page`                       | Browser page that fails the test on uncaught errors in any tab |

API role fixtures do not sign in the browser. In a browser test, call `signIn(page.request, scenario.customer.email)`, or use the login form when login is what you are testing. [booking.spec.ts](../tests/ui/booking.spec.ts) shows both.

The browser-error check has one exception: in WebKit it ignores prefetch requests to the app's own origin that WebKit cancelled. [Defects found](defects.md#cancelled-prefetches-in-webkit) explains why this is safe.

```ts
import { test, expect } from "../support/fixtures";

test("finds a published event by title", async ({ request, scenario }) => {
  const response = await request.get("/api/v1/events", {
    params: { query: scenario.event.title },
  });

  await expect(response).toBeOK();
  const { data } = await response.json();
  expect(data).toEqual([
    expect.objectContaining({
      id: scenario.event.id,
      title: scenario.event.title,
    }),
  ]);
});
```

Use role and label locators and web-first assertions, and avoid fixed waits. Check the database where it proves a business rule. Keep each UI test to one signed-in user, because switching users in the same page cancels Next.js prefetches. Do not loosen an assertion or add a retry to hide a failure. If a test needs extra records, keep them inside the scenario's cleanup or extend the cleanup.

## Troubleshooting

| Problem                                     | What to do                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Docker command or daemon not available      | Start Docker Desktop and run the command again                                           |
| Database connection or missing-table errors | Run `pnpm test:db:up` and `pnpm test:db:prepare`                                         |
| Browser executable missing                  | Run `pnpm exec playwright install chromium firefox webkit` (on Linux with `--with-deps`) |
| Port 3100 already in use                    | Close the other test run or UI mode; Playwright does not reuse an existing server        |
| An assertion fails                          | Read the first failure, open its trace and rerun that test before changing timeouts      |
