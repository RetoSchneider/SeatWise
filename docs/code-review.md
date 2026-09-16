# Code review

The review covered application services, API handlers, identity and authorization,
client forms, server pages, Prisma schema and migrations, local infrastructure,
existing tests, configuration, and operational documentation. Changes preserve
the existing Next.js modular monolith and use small functions and native
Playwright fixtures rather than adding a framework around the application.

## Fixed findings

| Finding                                                                | Change                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Event dates were sorted after pagination                               | PostgreSQL selects the page by earliest performance before event mapping                    |
| Duplicate GA entries bypassed ticket-type limits                       | Reject repeated ticket types; enforce assigned-seat limits too                              |
| Checkout accepted an existing hold after event cancellation            | Revalidate event, performance, and sales window before preparing payment                    |
| A checkout key could be reused with different inputs                   | Bind new orders to a request hash; preserve existing rows with an additive nullable column  |
| Browser retries generated a new key after an uncertain response        | Retain the key until a definitive payment failure                                           |
| Promotion limits counted only completed redemptions                    | Count pending and completed orders within serializable checkout preparation                 |
| Concurrent refund requests or decisions could both proceed             | Serialize request creation and conditionally claim rejection as well as approval            |
| Cancelled non-refundable events rejected customer refund requests      | Cancellation permits a refund request; zero refundable balances return a conflict           |
| Cancelled events could be moved back to another status                 | Reject subsequent organizer and administrator status changes                                |
| Cached roles remained usable after demotion                            | Read sessions without the role-bearing cookie cache                                         |
| Suspended organizers could review refunds                              | Require the owning organizer profile to remain active                                       |
| Incomplete organizer validation led to database or formatting failures | Validate schedules, currencies, sections, ticket limits, edit payloads, and IANA timezones  |
| PostgreSQL serialization failures escaped as 500 responses             | Retry database-only transactions up to three attempts and recognize adapter SQLSTATE errors |
| Venue forms accessed a React event after awaiting                      | Capture the form element before the request                                                 |
| Network failures left forms pending or silently redirected             | Handle failed requests and clear pending state; check release and status responses          |
| Cart countdown differed during hydration                               | Render the initial server-provided remaining time, then update in the browser               |
| Cart Apply label referenced a missing translation                      | Use the common label and add compile-time message typing                                    |
| Sign-in callbacks accepted backslash-based external destinations       | Resolve and compare callback origins before navigation                                      |
| Production HTTP previews forced HTTPS-only behavior                    | Apply secure cookies and transport headers to HTTPS origins                                 |
| The original concurrency and smoke scripts mutated seeded demo data    | Replace them with isolated Playwright scenarios against a guarded test database             |

Next.js was updated to 16.3.3, which addresses the published
[Windows server advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36).
The Prisma-specific overrides for `deepmerge-ts` and `mysql2` address transitive
advisories while retaining Prisma 7. Client generation, migrations, and the
production build are checked with these overrides.

Source comments were removed. Generated Prisma and Next.js files remain managed
by their tools. The pre-existing untracked `package-lock.json` was preserved;
pnpm and its tracked lockfile remain the project's package manager.

## Verification on 16 September 2026

Formatting, ESLint, TypeScript, and all 27 unit tests passed. The production
build passed, followed by 45 Playwright tests without retries:
27 API tests and nine browser scenarios each in Chromium and WebKit. Tests used
a real, isolated PostgreSQL 18.4 database. Dependency audits reported no known
vulnerabilities across production and development dependencies.

Firefox is configured but its executable could not launch on this Windows host
(`spawn UNKNOWN`). Docker is unavailable locally, so the Compose setup was not
executed. Automatic approval review blocked downloading and launching Mailpit
without providing a specific reason; SMTP delivery remains unverified. The
Ubuntu CI workflow includes all three browsers. Its first remote run exposed
the issues described below.

The checkout request-hash migration was applied only to the test database. Apply
pending migrations with `pnpm db:deploy` before running the updated application.

## CI follow-up

The first remote run reported nine React hydration failures across the booking
tests. The server formatted dates in UTC while browsers used Europe/Zurich.
Running the local server in UTC reproduced React error 418. Customer event,
cart, order, and ticket dates now explicitly use the venue timezone; other date
formatting defaults to UTC. The test server deliberately uses UTC to keep this
regression detectable on developer machines.

WebKit also reported cancelled Next.js prefetch requests as page errors when
the language test immediately reloaded the page. The test now verifies the
locale cookie and opens a fresh tab to check persistence across document loads.
Error collection covers all tabs. The redundant client refresh after the
cookie-setting Server Action was removed.

Test builds now have a separate output directory so the automated server can
run alongside the demo development server.

After these changes, formatting, ESLint, TypeScript, and 31 unit tests passed.
The UTC production server passed all 45 API, Chromium, and WebKit tests without
retries. The revised WebKit language test also passed ten consecutive runs.
Firefox and the updated remote CI run remain to be verified.

## Remaining scope

The payment provider is deliberately a simulator. Before connecting real money,
add durable provider reconciliation for process crashes between a provider result
and the database commit, and an idempotent notification outbox. Pending checkouts
are not automatically abandoned because releasing inventory after an uncertain
real payment requires reconciliation first.

Email intent and failures are persisted, but there is no background delivery
worker. Reservation expiry is demand-driven and processed in bounded batches.
Some management lists have fixed limits rather than full pagination. API error
messages and seeded event content are not fully localized. The OpenAPI document
is a maintained endpoint reference, not a generated exhaustive contract.

These are explicit portfolio boundaries, not claims of production readiness.
See [the test strategy](testing.md) for what is and is not verified.
