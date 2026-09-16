# Test strategy

SeatWise uses Vitest for small deterministic rules and Playwright for behavior
across browser, HTTP, authentication, services, and PostgreSQL. Payment outcomes
come from the application's local simulator. Business API responses are not
mocked. One browser test deliberately drops a checkout response after the
server commits it, then verifies a safe retry.

## Coverage

| Risk                                            | Verification                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Overselling assigned seats or general admission | Concurrent API requests; one winner; persisted inventory counts                                  |
| Duplicate charges or tickets                    | Idempotency replay, changed request rejection, lost-response UI retry, database assertions       |
| Payment failures                                | Decline, timeout, transient failure, and successful retry                                        |
| Invalid reservations                            | Duplicate ticket types, per-type limits, expiry, repeated release                                |
| Promotion overuse                               | Concurrent checkouts, exact totals and redemption count                                          |
| Unauthorized access                             | Anonymous requests, role checks, ownership, role changes, suspension, cross-origin writes        |
| Refund races                                    | Concurrent requests, competing reviews, one refund, restored inventory, invalidated tickets      |
| Catalog errors                                  | Sorting before pagination, browser search and empty results                                      |
| Organizer workflows                             | Event lifecycle, invalid venue input, browser venue creation and form reset                      |
| Browser regressions                             | Keyboard seat selection, ticket QR display, login failure, language persistence, uncaught errors |
| Input errors                                    | Malformed JSON, structured validation errors, request identifiers, reservation rate limiting     |

Unit tests cover price calculations, simulator outcomes, safe callback URLs,
event schedule rules, ticket limits, timezone validation, and transaction
conflict classification.

## Run locally

Install the dependencies and generate Prisma Client as described in the README.
Start the disposable infrastructure and apply migrations:

```bash
pnpm test:db:up
pnpm test:db:prepare
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

Playwright starts and stops its own application on port 3100. It refuses to reuse
an existing server, avoiding accidental tests against a demo or unrelated
process. Tests do not use `.env` database credentials. `TEST_DATABASE_URL` can
override the connection only for a local database named `seatwise_test`.

Each test receives its own customer, second customer, organizer, administrator,
venue, event, seats, standing inventory, and promotion. Role fixtures sign in
through Better Auth and dispose their request contexts afterward. API contexts
use separate test proxy IP headers to model independent clients without
disabling login rate limits. Only use these headers against the local test
server; a deployed reverse proxy must replace untrusted forwarded headers.

Database writes in test support create fixtures and set expiry boundaries.
Assertions then verify independently persisted order, payment, ticket, refund,
promotion, and inventory state. Teardown deletes records scoped to that test's
organizer and users. There are no production test-support endpoints.

## Targeted runs and debugging

```bash
pnpm test:api
pnpm exec playwright test --project=chromium
pnpm exec playwright test tests/ui/booking.spec.ts --project=webkit
pnpm test:e2e:ui
pnpm test:report
```

Locators use roles, labels, and visible text. Assertions wait for observable
state. There are no fixed browser sleeps or test-order dependencies. HTML and
JUnit reports are generated on every run; failed browser tests retain traces,
screenshots, and video. Reports and test runtime data are ignored by Git.

To test the optimized production build, set `PLAYWRIGHT_PRODUCTION=1` before
running Playwright. In PowerShell:

```powershell
$env:PLAYWRIGHT_PRODUCTION = "1"
pnpm test:e2e
Remove-Item Env:PLAYWRIGHT_PRODUCTION
```

The CI workflow runs formatting, lint, types, unit tests, and the production
Playwright suite on Ubuntu with Docker. A single CI retry records intermittent
failures; local runs have no retries. CI uploads test artifacts even on failure.

## Boundaries

This is functional and concurrency coverage, not a load test, penetration test,
or complete accessibility audit. The simulator does not exercise a real payment
gateway. SMTP delivery and inbox contents are not asserted by this suite; the
Mailpit container is available for inspecting application messages. No claim is
made that configuring CI proves a remote workflow passed.

The fixture design follows Playwright's
[fixture lifecycle](https://playwright.dev/docs/test-fixtures) and
[API testing](https://playwright.dev/docs/api-testing) guidance.
