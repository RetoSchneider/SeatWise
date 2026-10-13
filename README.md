# SeatWise

[![Quality](https://github.com/RetoSchneider/SeatWise/actions/workflows/quality.yml/badge.svg?branch=master)](https://github.com/RetoSchneider/SeatWise/actions/workflows/quality.yml)

SeatWise is an event-ticketing app built to show how I test a web application. Customers reserve seats and pay with a payment simulator, organizers run events and refunds, and administrators moderate. The Playwright suite runs API, browser and accessibility tests against the production build and a real PostgreSQL database.

**[Open the latest test report](https://retoschneider.github.io/SeatWise/)**: the Playwright HTML report from the last CI run on `master`.

<p>
  <img src="docs/images/seats.png" width="49%" alt="Seat selection with two selected seats">
  <img src="docs/images/cart.png" width="49%" alt="Checkout with a promotion code applied">
  <img src="docs/images/ticket.png" width="49%" alt="Issued ticket with QR code">
  <img src="docs/images/organizer.png" width="49%" alt="Organizer dashboard with sales and events">
</p>

## What the tests cover

| Risk                       | How it is tested                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Overselling                | Two customers reserve the same seat at once: one gets `201`, the other `409`, and the database agrees |
| Duplicate charges          | Idempotency-key replay, a reused key with different input, and a retry after a lost checkout response |
| Payment failures           | Declined, timed-out and transient payments, then a successful retry                                   |
| Unauthorized access        | Anonymous requests, wrong roles, other customers' orders, demoted sessions and suspended organizers   |
| Refund and promotion races | Concurrent requests checked against stored refunds, tickets, totals and redemption counts             |
| Accessibility              | axe-core scans 23 customer, organizer and admin pages for WCAG 2.2 A and AA issues                    |
| Browser behavior           | Keyboard seat selection, checkout, QR tickets and language switching in Chromium, Firefox and WebKit  |

Every test creates its own users and events and deletes them afterwards. The [testing guide](docs/testing.md) explains the full strategy, and [defects found](docs/defects.md) lists the bugs the tests and reviews caught.

## Run it

You need Node.js 22.14 or newer, pnpm 10.18.3 and Docker.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
```

**Demo:** start the services, load the demo data and open http://localhost:3000.

```bash
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Sign in as `customer@seatwise.local`, `organizer@seatwise.local` or `admin@seatwise.local` with the password `SeatWise!2026`. The [demo guide](docs/demo.md) walks through a booking.

**Tests:** these use their own database and port, so they can run next to the demo.

```bash
pnpm test:db:up
pnpm test:db:prepare
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:e2e
pnpm test:report
```

`pnpm check` runs formatting, ESLint, TypeScript and the Vitest unit tests. `pnpm test:e2e` builds the app and runs every Playwright project.

## Documentation

- [Testing guide](docs/testing.md): strategy, test data, debugging and adding tests
- [Defects found](docs/defects.md): bugs found by the tests and reviews, and how they were fixed
- [Demo guide](docs/demo.md): accounts, booking walkthrough and troubleshooting
- [API](docs/api.md), [architecture](docs/architecture.md), [operations and security](docs/operations.md) and [decision records](docs/adr)

Built with Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL 18, Better Auth, Playwright, Vitest and axe-core.

## How it was built

I built SeatWise with AI coding assistants. I chose the risks to test, designed the test strategy and reviewed the code and tests. `AGENTS.md` and `CLAUDE.md` are instruction files that Next.js 16 generates for coding agents.

## License

[MIT](LICENSE)
