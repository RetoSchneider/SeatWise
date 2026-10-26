# Demo guide

## Set up

You need Node.js 22.14 or newer, pnpm 10.18.3 and Docker Desktop (or Docker Engine with Compose). Run the commands from the project root.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
```

If pnpm is missing or a different version, use `npx --yes pnpm@10.18.3` instead of `pnpm`.

Open http://localhost:3000 and keep the terminal running. Next time, `docker compose up -d --wait` and `pnpm dev` are enough. After pulling changes, run `pnpm db:deploy` to apply new migrations.

`pnpm db:seed` replaces all demo data. Use it for the first setup or when you want a fresh demo.

The example environment is for local use only. A deployed environment needs its own `BETTER_AUTH_SECRET` and service credentials.

## Accounts

All demo accounts use the password `SeatWise!2026`.

| Role          | Email                      | What to try                                                           |
| ------------- | -------------------------- | --------------------------------------------------------------------- |
| Customer      | `customer@seatwise.local`  | Reservations, checkout, order history, QR tickets, refund requests    |
| Organizer     | `organizer@seatwise.local` | Venues, events, ticket inventory, promotions, orders, refund review   |
| Administrator | `admin@seatwise.local`     | User roles, organizer approval, event moderation, refunds, audit logs |

To use two roles at the same time, open the second one in a private window.

## Book a ticket

1. Sign in as the customer and open **Mitternachtssignale**.
2. Select one or more seats and choose **Reserve selection**. The cart holds the seats for 10 minutes.
3. Enter `WELCOME15` and choose **Apply**.
4. Choose **Successful payment**, then **Pay and get tickets**.
5. Choose **View ticket** to see the QR ticket. Orders and tickets also appear under **My account**.

To see a failure, choose **Declined payment** first. After the error, switch to **Successful payment** and pay again while the reservation is still active. **Release tickets** returns the seats immediately. Refund requests on paid orders go to the organizer or administrator for review.

## Language and email

The language menu switches between English and German; the choice is remembered in a cookie. Event times are shown in the venue's timezone. Seeded event texts and some API error messages stay in their original language.

Email goes to [Mailpit](http://localhost:8025) instead of real inboxes. There you can read ticket confirmations and password reset emails.

## Stop

Stop the app with `Ctrl+C`, then stop the containers:

```bash
docker compose down
```

The demo database is kept in a Docker volume. `pnpm db:reset` recreates it with fresh demo data and deletes everything else in it.

## Troubleshooting

| Problem                                     | What to do                                                  |
| ------------------------------------------- | ----------------------------------------------------------- |
| Docker command or daemon not available      | Start Docker Desktop and run the command again              |
| Prisma Client is missing                    | Run `pnpm db:generate`                                      |
| Database connection or missing-table errors | Run `docker compose up -d --wait`, then `pnpm db:deploy`    |
| Demo accounts or events are missing         | Run `pnpm db:seed`, which replaces the demo data            |
| Port 3000 is in use                         | Stop the other process; sign-in is configured for port 3000 |
