# Architecture

SeatWise is a modular monolith. One deployable Next.js application owns the
HTTP boundary, server-rendered UI, application services, and persistence
adapters. PostgreSQL is the transactional source of truth. Mailpit and the
payment simulator are replaceable local adapters.

## System context

```mermaid
flowchart LR
  Customer[Customer browser]
  Organizer[Organizer browser]
  Admin[Administrator browser]
  App[SeatWise Next.js application]
  DB[(PostgreSQL)]
  Mail[Mailpit SMTP and inbox]
  Pay[Local payment simulator]

  Customer -->|HTTPS and session cookie| App
  Organizer -->|HTTPS and session cookie| App
  Admin -->|HTTPS and session cookie| App
  App -->|Prisma transactions| DB
  App -->|EmailSender| Mail
  App -->|PaymentProvider| Pay
```

## Module dependencies

```mermaid
flowchart TB
  App[App Router and route handlers]
  Identity[identity and users]
  Catalog[venues and events]
  Inventory[inventory and reservations]
  Commerce[pricing promotions orders]
  Fulfillment[payments tickets refunds]
  Ops[notifications audit]
  Shared[shared infrastructure]

  App --> Identity
  App --> Catalog
  App --> Inventory
  App --> Commerce
  App --> Fulfillment
  Identity --> Shared
  Catalog --> Shared
  Inventory --> Catalog
  Inventory --> Shared
  Commerce --> Inventory
  Commerce --> Shared
  Fulfillment --> Commerce
  Fulfillment --> Ops
  Fulfillment --> Shared
  Ops --> Shared
```

Route handlers contain no pricing, inventory, or authorization policy. They
authenticate, validate with Zod, apply endpoint-level rate limits, call one
application service, and return the common JSON envelope.

## Seat reservation flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Reservation API
  participant S as Reservation service
  participant P as PostgreSQL

  B->>A: POST selection
  A->>A: Validate session, origin, body, rate
  A->>S: createReservation(user, selection)
  S->>P: BEGIN SERIALIZABLE
  S->>P: Claim expired reservations
  S->>P: Create reservation and expiry
  loop Each assigned seat
    S->>P: UPDATE inventory WHERE state = AVAILABLE
    P-->>S: affected row count
  end
  S->>P: Atomic GA capacity increments
  S->>P: Create immutable price snapshots and cart
  S->>P: COMMIT
  S-->>A: Authoritative reservation
  A-->>B: 201 and countdown
```

An assigned seat is acquired only by a conditional database update. If two
transactions select the same inventory row, only one update can affect it; the
other transaction rolls back. General-admission acquisition uses an arithmetic
`UPDATE` whose predicate requires remaining capacity.

Expired active reservations are atomically claimed before their inventory is
released. The claim prevents two application instances from decrementing the
same general-admission hold twice.

## Checkout flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Checkout API
  participant O as Order service
  participant P as PostgreSQL
  participant Pay as Payment provider
  participant Mail as Email sender

  B->>A: POST checkout + Idempotency-Key
  A->>O: checkout(user, reservation, token, key)
  O->>P: Find order by user + key
  alt New key
    O->>P: SERIALIZABLE revalidation and pending order
  else Existing paid order
    O-->>A: Original result
  end
  O->>Pay: Charge with stable provider key
  Pay-->>O: Success or deterministic failure
  alt Success
    O->>P: Mark payment, sell inventory, issue tickets, redeem promotion
    O->>P: Write audit event and commit
    O->>Mail: Persist and send confirmation
    O-->>A: Paid order
  else Failure
    O->>P: Persist failed attempt and return hold to active state
    O-->>A: Typed retryable error
  end
```

The unique `(userId, idempotencyKey)` order constraint and unique provider
attempt key prevent duplicate orders and charges. Browser totals, roles, user
IDs, and inventory state are not accepted as checkout inputs.

## Persistence

The Prisma schema uses normalized entities for identities, organizer profiles,
venues, sections, rows, seats, events, performances, ticket types, assigned and
general-admission inventory, reservations, carts, promotions, orders, payment
attempts, tickets, refunds, notifications, and audit events.

Checked-in SQL migrations add constraints that Prisma cannot express,
including:

- internally consistent assigned-seat inventory state
- nonnegative and arithmetically consistent order totals
- GA reserved plus sold counts within capacity
- valid sales, promotion, and schedule windows
- positive quantities, attempt numbers, and refund amounts

All stored instants are PostgreSQL timestamps and are treated as UTC.
Formatting happens at UI and email boundaries.
