# Defects found

These defects were found by the test suite, by CI and by code review, and are fixed in the current version.

## Fixed defects

| Defect                                                                                       | Fix                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Event dates were sorted after pagination, so pages showed the wrong events                   | PostgreSQL selects the page by earliest performance before events are mapped              |
| Repeating a general-admission ticket type bypassed the per-order limit                       | Reject repeated ticket types and enforce limits for assigned seats too                    |
| Checkout accepted an existing hold after the event was cancelled                             | Revalidate event, performance and sales window before payment                             |
| An idempotency key could be reused with different checkout input                             | Store a hash of the request with the order and reject a mismatch                          |
| A browser retry after an uncertain response created a new idempotency key                    | Keep the key until the payment has definitely failed                                      |
| Promotion limits counted only completed redemptions                                          | Count pending and completed orders inside the serializable checkout transaction           |
| Two concurrent refund requests or reviews could both succeed                                 | Serialize refund requests and claim approval and rejection conditionally                  |
| Customers could not request a refund for a cancelled non-refundable event                    | Cancellation allows a refund request; a zero refundable balance returns a conflict        |
| A cancelled event could be moved back to another status                                      | Reject status changes after cancellation                                                  |
| A demoted user kept their old role until the session cookie expired                          | Read sessions without the role-carrying cookie cache                                      |
| Suspended organizers could still review refunds                                              | Require the owning organizer profile to be active                                         |
| Incomplete organizer validation caused database or formatting errors                         | Validate schedules, currencies, sections, ticket limits, edit payloads and IANA timezones |
| PostgreSQL serialization failures surfaced as `500` responses                                | Retry database-only transactions up to three times                                        |
| The venue form read a React event after an `await`                                           | Capture the form element before the request                                               |
| Network failures left forms stuck in a pending state                                         | Handle failed requests and reset pending state; check release and status responses        |
| The cart countdown differed between server and browser during hydration                      | Render the server's remaining time first, then count down in the browser                  |
| The cart's Apply button used a missing translation                                           | Use the shared label and type-check message keys                                          |
| Sign-in callbacks accepted backslash-based external URLs                                     | Resolve the callback and compare its origin before redirecting                            |
| Production previews over HTTP forced HTTPS-only cookies                                      | Apply secure cookies and transport headers only on HTTPS origins                          |
| The original concurrency and smoke scripts changed the seeded demo data                      | Replace them with isolated Playwright scenarios on a separate, guarded test database      |
| Event cards nested `<dt>` and `<dd>` in extra wrappers, breaking the list for screen readers | Found by the axe scan; the markup now follows the event detail page                       |
| The organizer dashboard and admin event list showed start times in UTC                       | Format them in the venue's timezone; covered by a UI test                                 |

## Found by CI

The first CI run failed nine booking tests with React hydration errors (error 418). The server formatted dates in UTC while the browsers used Europe/Zurich, so server and browser rendered different text. Customer-facing dates now use the venue's timezone. To keep this kind of bug visible on any machine, the test server always runs in UTC while the browsers run in Europe/Zurich.

The same run showed WebKit reporting cancelled Next.js prefetch requests as page errors when a test reloaded the page right after changing the language. The test now checks the language cookie and opens a new tab instead of reloading. The browser-error check still covers every tab and filters nothing.

## Dependency advisories

Next.js is on 16.3.3, which fixes a [Windows server advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36). The overrides for `deepmerge-ts` and `mysql2` in `pnpm-workspace.yaml` fix advisories in Prisma's transitive dependencies.

## Known limitations

- Payments use a simulator. A real provider would need reconciliation for crashes between the provider's answer and the database commit, and an outbox for notifications.
- Pending checkouts are not abandoned automatically, because releasing seats after an uncertain real payment would need reconciliation first.
- Emails are stored with their delivery result, but there is no background worker that retries failed deliveries.
- Expired reservations are released when inventory is next read, in small batches, not by a scheduled job.
- Some management lists have fixed limits instead of full pagination.
- API error messages and seeded event texts are not fully translated.
- The OpenAPI document is maintained by hand and does not describe every response body.
