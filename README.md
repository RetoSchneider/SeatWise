# SeatWise

SeatWise is an event-ticketing app with customer, organizer, and administrator
workflows. Customers can reserve seats or standing tickets, try simulated
payments, and open QR tickets. Organizers manage venues, events, promotions, and
refunds. Administrators manage users and moderate events.

The project also demonstrates test automation with Playwright, real HTTP APIs,
and PostgreSQL. Payments are simulated; no real money or card details are used.

- [Set up the project](#set-up-the-project)
- [For app users](#for-app-users)
- [For testers](#for-testers)
- [Troubleshooting](#troubleshooting)
- [Technical documentation](#technical-documentation)

## Set up the project

Requirements:

- Node.js 22.14 or newer
- pnpm 10.18.3, matching `package.json`
- Docker Desktop running, or Docker Engine with Compose

Run commands from the project root. For a first-time setup in PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
pnpm install --frozen-lockfile
pnpm db:generate
```

On macOS or Linux, replace the first command with:

```bash
[ -f .env ] || cp .env.example .env
```

Check your package manager with `pnpm --version`. If pnpm is missing or the installed version differs,
replace `pnpm` in these instructions with `npx --yes pnpm@10.18.3`.

The example environment is for local development. Use a unique
`BETTER_AUTH_SECRET` and appropriate service credentials for a deployed environment.

## For app users

### Start the demo

After the shared setup, start the demo services and create the demo data:

```bash
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
```

`pnpm db:seed` replaces demo data. Use it for initial setup or an intentional
fresh demo, not every time you start the app.

Open [SeatWise](http://localhost:3000). Keep the terminal running while using it.
For subsequent starts, run `docker compose up -d --wait` and `pnpm dev`. Apply
new migrations with `pnpm db:deploy` after pulling changes.

### Sign in

All seeded demo accounts use the password `SeatWise!2026`.

| Role          | Email                      | What to explore                                                       |
| ------------- | -------------------------- | --------------------------------------------------------------------- |
| Customer      | `customer@seatwise.local`  | Reservations, checkout, order history, QR tickets, refund requests    |
| Organizer     | `organizer@seatwise.local` | Venues, events, ticket inventory, promotions, orders, refund review   |
| Administrator | `admin@seatwise.local`     | User roles, organizer approval, event moderation, refunds, audit logs |

Use separate browser profiles or private windows to demonstrate different roles
at the same time. Otherwise, sign out before switching accounts.

### Book a ticket

1. Sign in as the customer and browse the events.
2. Open an event, select a performance, and choose seats or a standing-ticket quantity.
3. Select **Reserve selection** to open the timed cart.
4. Enter `WELCOME15` and select **Apply** to try the seeded promotion.
5. Choose **Successful payment**, then **Pay and get tickets**.
6. Open **View ticket** to display the QR ticket. Orders and tickets also appear in your account.

Reservations expire if checkout is not completed in time. Use **Release tickets**
to return a reservation's inventory immediately. Promotion availability depends
on its rules and previous usage. Refund requests are available on eligible orders
and require organizer or administrator review.

To demonstrate a failure, choose **Declined payment** at checkout. After the
error appears, choose **Successful payment** and retry while the reservation is
still active. Timeout and temporary-failure options are also available.

### Language and email

Use the header's language selector to switch between English and German. The
choice is saved in a cookie. Event times use the venue's timezone. Some API error
messages and seeded event content remain in their original language.

Local email is captured by [Mailpit](http://localhost:8025), where you can inspect
messages such as ticket notifications and password resets. These messages are
not delivered to real inboxes.

### Stop the demo

Stop the app with `Ctrl+C`, then stop its containers:

```bash
docker compose down
```

Demo database data remains in Docker's named volume. To deliberately recreate
the database and demo data, start its containers and run `pnpm db:reset`. This
command deletes existing application data.

## For testers

### Start the isolated test environment

Complete the shared project setup first. You do not need the demo server, demo
accounts, or `pnpm db:seed` to run automation.

```bash
pnpm test:db:up
pnpm test:db:prepare
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:e2e
```

Playwright is already a project dependency with a checked-in configuration. Do
not run an initialization wizard or install a second test framework. Dependency
installation installs the runner; `playwright install` separately downloads the
browser binaries it needs. Run that browser-install command on a new machine
and after updating Playwright. On Linux, install browser system dependencies too:

```bash
pnpm exec playwright install --with-deps chromium firefox webkit
```

For later sessions, start the test containers, prepare the database, and run the
tests. Repeat `pnpm install --frozen-lockfile` and `pnpm db:generate` when the
dependency lockfile or Prisma schema changes. The setup commands above can be
run again without resetting demo data.

`pnpm check` runs formatting, ESLint, TypeScript, and Vitest unit tests. Unit tests
can also run independently with `pnpm test`; they do not need a database service.
`pnpm test:e2e` runs API tests and UI tests in Chromium, Firefox, and WebKit.

Playwright starts and stops its own app. Each scenario creates unique users and
event data, signs in through the real authentication API, and deletes its own
records afterward. Tests make real API and database calls. No shared seeded
account is required.

| Service         | Demo                    | Automation               |
| --------------- | ----------------------- | ------------------------ |
| App             | `http://localhost:3000` | `http://localhost:3100`  |
| PostgreSQL port | `5432`                  | `55432`                  |
| Database        | `seatwise`              | `seatwise_test`          |
| SMTP port       | `1025`                  | `11025`                  |
| Mailpit         | `http://localhost:8025` | `http://localhost:18025` |
| Next.js output  | `.next`                 | `.next/playwright`       |

The demo and automation can run alongside each other. Leave port 3100 free;
Playwright refuses to reuse an existing server. Test database credentials are
separate from `.env`, and overrides are restricted to a local database named
`seatwise_test`. The test server uses UTC while browsers use Europe/Zurich to
catch timezone-dependent hydration errors.

### Understand the Playwright setup

The files that control the suite are:

| File                                                                 | Responsibility                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [playwright.config.ts](playwright.config.ts)                         | Projects, browsers, server startup, timeouts, retries, and reports      |
| [tests/support/environment.ts](tests/support/environment.ts)         | Test-only environment values and the database URL guard                 |
| [compose.test.yaml](compose.test.yaml)                               | Disposable PostgreSQL and Mailpit services                              |
| [scripts/prepare-test-database.ts](scripts/prepare-test-database.ts) | Apply migrations to the guarded test database                           |
| [tests/support/fixtures.ts](tests/support/fixtures.ts)               | Scenario lifecycle, authenticated API clients, and browser-error checks |
| [tests/support/scenario.ts](tests/support/scenario.ts)               | Create isolated database records and remove them after each scenario    |
| [tests/support/api.ts](tests/support/api.ts)                         | Small reservation and checkout request helpers                          |
| [.github/workflows/quality.yml](.github/workflows/quality.yml)       | Installation, checks, production tests, and artifacts in CI             |

There are four Playwright projects. `api` discovers `tests/api/**/*.spec.ts` and
does not launch a browser. `chromium`, `firefox`, and `webkit` each run
`tests/ui/**/*.spec.ts`. Therefore, one new UI test runs three times in the full
suite, while one API test runs once. Vitest tests under `src` run separately.

The runner uses two workers with parallel tests, a 45-second test timeout, and
a 10-second assertion timeout. Server startup has a separate 180-second timeout
and waits for `/api/v1/health/ready`. By default, the server uses development
mode; setting `PLAYWRIGHT_PRODUCTION=1` switches it to a production build.

A typical run starts the app, creates the fixtures requested by each test,
performs browser or API actions, checks the results, cleans up that test's data,
and writes the report. The runner stops the app; the Docker services stay up
until you run `pnpm test:db:down`. You do not need to sign in manually or provide
demo credentials to the tests.

To inspect discovered tests without starting the app or running scenarios:

```bash
pnpm exec playwright test --list
```

### Watch and debug tests

Open the interactive runner, select a test, and inspect its actions and snapshots:

```bash
pnpm exec playwright test --project=chromium --ui
```

Close the interactive runner before starting another run that needs port 3100.
For a visible browser run, use:

```bash
pnpm exec playwright test tests/ui/booking.spec.ts --project=chromium --headed
```

Useful targeted commands:

| Command                                                                           | Scope                                                |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm test:api`                                                                   | API and database assertions                          |
| `pnpm exec playwright test --project=chromium`                                    | Chromium UI tests                                    |
| `pnpm exec playwright test tests/api/reservations.spec.ts --project=api`          | Reservation concurrency, limits, expiry, and release |
| `pnpm exec playwright test tests/ui/booking.spec.ts --project=webkit`             | Booking flows in WebKit                              |
| `pnpm exec playwright test --project=chromium --grep "declined payments" --debug` | Step through the payment-retry test                  |

### Read results

After a run, open the HTML report:

```bash
pnpm test:report
```

The terminal prints the failed assertion and artifact paths. Failed browser
tests retain screenshots, video, and traces under `test-results/`. Open the
trace from the report or run `pnpm exec playwright show-trace` with the actual
`trace.zip` path printed in the failure output. JUnit results are written to
`test-results/results.xml`; the HTML report is in `playwright-report/`.

Local runs have no retries. CI allows one retry; investigate a test that only
passes on retry rather than treating it as reliable.

Use the trace's action timeline to inspect the page before and after the failed
step, its locator, and the related network requests. Distinguish a setup failure
(database or browser unavailable) from an assertion failure (unexpected app
behavior). A browser-error assertion can also fail after the visible flow has
completed, for example when React reports a hydration mismatch.

Reports describe the latest run and can be replaced by the next one. Copy any
evidence you need before rerunning. To check whether a specific fix is stable:

```bash
pnpm exec playwright test --project=chromium --grep "declined payments" --repeat-each=5 --retries=0
```

### Match the CI run

CI runs the optimized production app on Ubuntu with Docker and all three
browsers. To run against the production build locally in PowerShell:

```powershell
pnpm check
$env:PLAYWRIGHT_PRODUCTION = "1"
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_PRODUCTION
```

On macOS or Linux:

```bash
pnpm check
PLAYWRIGHT_PRODUCTION=1 pnpm test:e2e
```

The test infrastructure must already be running and migrated. Playwright builds
the production app automatically. In GitHub Actions, open the **Quality** run,
inspect the **verify** job, and download the **playwright-results** artifact for
reports and failure evidence.

CI runs on pushes and pull requests, rejects committed `test.only` calls, and
retains uploaded artifacts for seven days. Running the production suite locally
matches the application mode, but the CI run still verifies the Ubuntu host.
Remove `PLAYWRIGHT_PRODUCTION` when returning to development-mode tests; setting
it to the string `"0"` still enables production mode in the current configuration.

### Add a test

Choose the layer that demonstrates the behavior: use `tests/api` for business
rules, authorization, and database state; use `tests/ui` for user interactions.
Name the file `*.spec.ts` and import `test` and `expect` from
`../support/fixtures` so the existing isolation and error checks apply.

Available fixtures include:

| Fixture                      | Use                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| `scenario`                   | Unique users, event, venue, seats, ticket types, and promotion |
| `request`                    | An unauthenticated API request context                         |
| `customer`, `otherCustomer`  | Separate authenticated customer API contexts                   |
| `organizer`, `administrator` | Authenticated API contexts for role-specific behavior          |
| `page`                       | A browser page with uncaught-error checks across its context   |

API role fixtures do not automatically sign in the browser. For browser tests,
use `await signIn(page.request, scenario.customer.email)` with `signIn` imported
from the fixture module, or exercise the login form when login is part of the
behavior being tested. See [booking.spec.ts](tests/ui/booking.spec.ts) for both.

For example, a small public API test in `tests/api/event-search.spec.ts` could be:

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

Use role and label locators and assertions that wait for observable state. Keep
tests independent, avoid fixed sleeps, and check persisted database state where
it proves a business rule. Do not weaken error assertions or add retries to hide
a failure. If a scenario needs extra records, keep them within its cleanup scope
or extend cleanup explicitly. Run the new test by file, then `pnpm check` and
the relevant projects before submitting changes.

### What the automation proves

| Risk                       | Evidence                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Overselling                | Concurrent reservation requests produce one winner; database assertions verify inventory             |
| Duplicate checkout         | Idempotency replay, changed-input rejection, and retry after a lost response                         |
| Payment failures           | Decline, timeout, transient failure, and successful retry                                            |
| Unauthorized access        | Anonymous access, roles, ownership, suspension, and session role changes                             |
| Refund and promotion races | Competing requests checked against persisted refunds, tickets, totals, and redemption counts         |
| Customer experience        | Login, keyboard seat selection, checkout, QR tickets, language persistence, and browser-error checks |

For a short demonstration, show a manual booking, run
[the browser booking tests](tests/ui/booking.spec.ts), then explain
[the concurrent reservation test](tests/api/reservations.spec.ts) and its database
assertions. Finish with the HTML report and the CI run.

Payments use a simulator. SMTP delivery, load capacity, and complete security or
accessibility audits are outside the automated suite's scope. See the
[test strategy](docs/testing.md) for fixtures, isolation, coverage, and boundaries.

### Stop the test environment

After closing the runner or report server with `Ctrl+C`:

```bash
pnpm test:db:down
```

Test PostgreSQL storage is temporary. After restarting the test containers, run
`pnpm test:db:prepare` again before testing.

## Troubleshooting

| Symptom                                     | What to check                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Docker command or daemon unavailable        | Install or start Docker Desktop, then rerun the infrastructure command                                                 |
| Missing Prisma Client                       | Run `pnpm db:generate` after installing dependencies                                                                   |
| Database connection or missing-table errors | Start the correct stack; use `pnpm db:deploy` for the demo or `pnpm test:db:prepare` for tests                         |
| Browser executable missing                  | Run `pnpm exec playwright install chromium firefox webkit`; on Linux, add `--with-deps` to install system dependencies |
| Port 3100 is already in use                 | Close another test runner or the process using that port, then rerun                                                   |
| Demo accounts or events are missing         | Run `pnpm db:seed` only if you intend to replace the demo data                                                         |
| A browser cannot launch on your machine     | Inspect the launch error and verify that browser in CI; a passing run in another browser does not verify it            |
| An assertion fails                          | Read the first failure, inspect its trace, and rerun the specific test before changing timeouts or adding retries      |

## Technical documentation

Built with Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL 18, Better Auth,
next-intl, Tailwind CSS, Vitest, Playwright, Docker Compose, and Mailpit.

- [API guide](docs/api.md), [local API documentation](http://localhost:3000/docs/api), and [OpenAPI JSON](http://localhost:3000/api/v1/openapi)
- [Test strategy](docs/testing.md)
- [Code review and fixes](docs/code-review.md)
- [Architecture](docs/architecture.md)
- [Operations and security](docs/operations.md)
- [ADR 0001: Modular monolith](docs/adr/0001-modular-monolith.md)
- [ADR 0002: Inventory concurrency](docs/adr/0002-inventory-concurrency.md)
- [ADR 0003: Local integration adapters](docs/adr/0003-local-integrations.md)

Business logic lives in `src/modules`, API routes in `src/app/api`, Playwright
scenarios in `tests/api` and `tests/ui`, and shared test fixtures in `tests/support`.
