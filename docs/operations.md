# Operations and security

## Health

- `GET /api/v1/health/live` confirms that the application process can respond.
- `GET /api/v1/health/ready` runs a PostgreSQL query and fails if the database
  is unavailable.
- Mailpit exposes `/livez` and `/readyz` on port 8025 and is monitored by the
  Compose health check.

`docker compose up -d --wait` waits for both local infrastructure containers.

## Reservation expiry

Every availability read, reservation, cart read, promotion application, and
checkout runs the expiry sweep before using inventory. The sweep:

1. atomically changes one due `ACTIVE` reservation to `EXPIRED`
2. clears its assigned-seat holds
3. decrements its GA reserved quantities
4. marks its cart abandoned

Only the process that wins the conditional status update releases inventory.
This makes the sweep safe across multiple application instances. A production
deployment can additionally invoke the same application service on a schedule
to reduce stale hold rows during periods with no traffic; correctness does not
depend on the schedule because checkout always revalidates expiry.

## Logging and audit

Server logs are structured JSON through Pino. Passwords, tokens, authorization
headers, and cookies are redacted. API log records include request ID, method,
path, status, and stable error code.

Security-sensitive and business-sensitive state changes are persisted in the
audit log, including order checkout, payment results, refunds, role changes,
organizer status, event moderation, and venue/event creation. IP addresses are
stored only as keyed hashes.

## Security controls

- Argon2id password hashing with an OWASP-aligned 19 MiB memory cost and two
  passes
- HttpOnly, SameSite=Lax session cookies; Secure cookies on HTTPS origins
- Better Auth origin checks and trusted redirect origins
- additional same-origin validation for versioned business mutations
- role and ownership checks on every protected server operation
- Zod validation at API and form trust boundaries
- parameterized Prisma queries and tagged raw SQL
- CSP with per-request script nonces, frame denial, MIME sniffing denial,
  restrictive permissions policy, and HTTPS HSTS
- database-backed rate limiting for reservation and checkout endpoints and
  Better Auth rate limiting for identity endpoints
- generic authentication failures and safe API error translation
- no accepted or stored card numbers, security codes, or browser-supplied totals

## Backups and migration

Prisma migrations are forward-only checked-in SQL. Run `pnpm db:deploy` during
deployment before starting the new application version. Back up PostgreSQL
before schema changes in any durable environment.

The local Compose volume is named `seatwise-postgres`. `docker compose down -v`
deletes all local database and Mailpit data.

## Email

Development mail is sent over SMTP to `SMTP_HOST:SMTP_PORT` and inspected in
Mailpit. Notification intent and delivery result are persisted. Delivery
failure does not roll back a paid order; it is recorded for retry or operator
review.

Replace `EmailSender` with a durable provider adapter and queue in a hosted
deployment. Replace `PaymentProvider` with a PCI-compliant hosted-token
provider; keep the current application interface and idempotency semantics.

## Environment

Secrets are never committed. Required runtime configuration is validated at
startup. Use a unique `BETTER_AUTH_SECRET`, HTTPS origin, managed PostgreSQL
credentials, and trusted SMTP configuration outside local development.
