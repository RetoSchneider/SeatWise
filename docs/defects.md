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
| The organizer dashboard and admin event list showed start times in UTC                       | Format them in the venue's timezone; covered by UI tests                                  |

## Found by CI

The first CI run failed nine booking tests with React hydration errors (error 418). The server formatted dates in UTC while the browsers used Europe/Zurich, so server and browser rendered different text. Customer-facing dates now use the venue's timezone. To keep this kind of bug visible on any machine, the test server always runs in UTC while the browsers run in Europe/Zurich.

### Cancelled prefetches in WebKit

Next.js prefetches the pages behind visible links with `fetch` requests (`?_rsc=` in the URL). When WebKit cancels one of these requests, for example because the page navigates away, it reports an uncaught error: `Fetch API cannot load <url> due to access control checks.` Chromium and Firefox do not report cancelled prefetches this way.

The first CI run hit this in the language test, which reloaded the page right after changing the language. That test now checks the language cookie and opens a new tab instead of reloading.

It came back in a UI test that checked the organizer dashboard, then cleared the cookies, signed in as an administrator and opened the admin event list in the same page. WebKit reported the cancelled prefetches of the dashboard's links, such as `/events`, `/account` and `/organizer/promotions`. On Linux the test failed in 4 of 5 WebKit runs. Two changes fixed it:

- The test is now two tests, one per role, so no test switches users in the middle of a page. The two tests passed 30 of 30 WebKit runs on Linux without any filter.
- In WebKit only, the browser-error check ignores this one message when the URL is on the app's own origin.

The filter is deliberately narrow. It matches the exact WebKit message, only for URLs on the app's origin, and only in WebKit. Same-origin requests are not subject to CORS, so on the app's own origin this message comes from a cancelled request, not from a real access-control failure. Every other error, every other origin and all errors in Chromium and Firefox still fail the test.

## Dependency advisories

Next.js is on 16.3.3, which fixes a [Windows server advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36). The overrides for `deepmerge-ts` and `mysql2` in `pnpm-workspace.yaml` fix advisories in Prisma's transitive dependencies.
