# SeatWise

SeatWise is a full-stack event-ticketing and venue-management application. A
single Next.js application serves customer, organizer, and administrator
experiences backed by PostgreSQL. The project is designed as an engineering
portfolio: it emphasizes explicit business boundaries, database-enforced
integrity, secure authorization, deterministic local integrations, and
operational clarity.

## What is included

- Event discovery with search, filters, sorting, pagination, live seat
  availability, and general-admission inventory
- Keyboard-operable assigned-seat selection and a timed, server-authoritative
  cart
- Database-safe inventory reservation, reservation expiry, promotion
  validation, and idempotent checkout
- Deterministic payment success, decline, timeout, and transient-failure paths
- Customer profiles, order history, refund requests, and QR ticket wallet
- Organizer venue layouts, event scheduling, pricing, inventory, publishing,
  promotions, attendee orders, and refund processing
- Administrator user roles, organizer approval, event moderation, refund
  oversight, audit logs, and dependency health
- Better Auth credential sessions, local password reset and verification email,
  structured API errors, same-origin mutation checks, security headers, and
  sensitive-route rate limits
- OpenAPI 3.1 at `/api/v1/openapi` and readable documentation at `/docs/api`
- Bilingual interface (English and German) with locale-aware date and currency
  formatting and an accessible in-header language switcher

## Technology

Next.js 16 App Router, React 19, strict TypeScript, PostgreSQL 18, Prisma ORM 7,
Tailwind CSS 4, Better Auth, Zod, next-intl, pnpm, Vitest, Docker Compose, and
Mailpit.

## Local setup

Requirements:

- Node.js 22.14 or newer
- pnpm 10
- Docker Desktop or a compatible Docker Engine with Compose

From a clean checkout:

```bash
cp .env.example .env
pnpm install
docker compose up -d --wait
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Open:

- Application: http://localhost:3000
- API documentation: http://localhost:3000/docs/api
- Mailpit: http://localhost:8025
- Liveness: http://localhost:3000/api/v1/health/live
- Readiness: http://localhost:3000/api/v1/health/ready

The checked-in `.env.example` contains local-only placeholders. Generate a
strong, unique `BETTER_AUTH_SECRET` before using any non-local environment.

## Demo accounts

Demo identities are created only by the development seed. They all use
`SeatWise!2026`.

- Customer: `customer@seatwise.local`
- Organizer: `organizer@seatwise.local`
- Administrator: `admin@seatwise.local`

The seed is deterministic and includes an assigned-seat event, a
general-admission event, accessible seats, and promotion code `WELCOME15`.

Reset all local application data:

```bash
pnpm db:reset
```

The reset command is destructive and is intended only for local or disposable
test databases.

## Payment simulator

Checkout accepts only opaque simulator tokens. It does not accept or persist
card data.

- `pm_success` — completed payment and ticket issuance
- `pm_decline` — deterministic decline
- `pm_timeout` — provider timeout
- `pm_transient` — retryable provider availability failure

Checkout requires an `Idempotency-Key` header. Repeating the same key for the
same user resolves to the original order and payment attempt. A user-facing
retry creates a new key after a failed attempt while the reservation remains
valid.

## Internationalization

The interface is available in English (`en`) and German (`de`), implemented with
[`next-intl`](https://next-intl.dev). Every user-facing string lives in a message
catalog under `messages/`, and dates, numbers, and currency are formatted for the
active locale.

- Message catalogs: `messages/en.json` and `messages/de.json`
- Locale configuration and BCP-47 mapping: `src/i18n/config.ts`
- Request configuration (reads the locale cookie): `src/i18n/request.ts`
- Locale cookie server action: `src/i18n/locale.ts`

The active locale is resolved from the `seatwise.locale` cookie rather than a URL
segment. This keeps the existing routes, authentication callbacks, redirects, and
CSP proxy unchanged, and lets the header language switcher change the language
with a single server action. The tradeoff is that locales do not have distinct
URLs; if per-locale SEO were required, a `[locale]` routing segment would be the
next step. The default locale is English; demo content in the seed is German
only, so both languages share the same catalog data.

To add a locale, extend `locales` in `src/i18n/config.ts`, add its BCP-47 tag,
and provide a matching `messages/<locale>.json` catalog.

## Commands

```bash
pnpm dev             # development server
pnpm build           # optimized production build
pnpm start           # run the production build
pnpm format          # format source and documentation
pnpm format:check    # verify formatting
pnpm lint            # ESLint
pnpm typecheck       # strict TypeScript
pnpm test            # unit and PostgreSQL concurrency tests
pnpm check           # format, lint, types, and tests
pnpm db:generate     # generate Prisma Client
pnpm db:migrate      # create/apply a development migration
pnpm db:deploy       # apply checked-in migrations
pnpm db:seed         # replace data with deterministic demo data
pnpm db:reset        # reset migrations and reseed
```

`pnpm test` expects the Compose PostgreSQL service and the seeded baseline to be
available. The concurrency test creates isolated users and removes them after
the test.

## Test environment

Use a separate PostgreSQL database and set `NODE_ENV=test`. Copy the safe
variables from `.env.example`, point `DATABASE_URL` at the disposable database,
then run migrations and seed explicitly. Production authentication is not
weakened for tests; the replaceable clock, payment provider, email sender, and
identifier interfaces support deterministic service tests.

No test-support mutation API is exposed.

## Architecture and operations

- [Architecture and Mermaid diagrams](docs/architecture.md)
- [REST API conventions](docs/api.md)
- [Operations and security](docs/operations.md)
- [ADR 0001: Modular monolith](docs/adr/0001-modular-monolith.md)
- [ADR 0002: Inventory concurrency](docs/adr/0002-inventory-concurrency.md)
- [ADR 0003: Local integration adapters](docs/adr/0003-local-integrations.md)

Business rules live in `src/modules`; App Router handlers authenticate,
validate, invoke services, and translate results. Shared code is limited to
infrastructure, domain primitives, HTTP conventions, presentation, and
cross-domain UI.
