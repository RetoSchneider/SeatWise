# ADR 0002: Acquire inventory with conditional database writes

Status: accepted

## Context

Reading availability before writing a reservation permits two customers to
observe and buy the same seat. An application-process lock would fail across
instances and after restarts.

## Decision

Treat PostgreSQL as the concurrency authority.

Assigned inventory is claimed with an update whose predicate includes
`state = AVAILABLE`. The update sets the reservation foreign key and expiry in
the same statement. The transaction must observe one affected row for every
requested seat or it rolls back.

General-admission inventory uses an arithmetic update whose predicate requires
`capacity - reserved - sold >= requested`. Reservation creation and checkout
run at serializable isolation. Database check constraints enforce valid state
combinations and nonnegative capacity arithmetic.

Expiry workers first conditionally change one reservation from `ACTIVE` to
`EXPIRED`; only the winner releases its inventory.

## Consequences

Correctness holds across application instances and does not depend on UI
freshness. Contending transactions may retry or return a conflict, which is an
expected customer-facing state. PostgreSQL-specific tagged SQL is retained in
the inventory module because Prisma cannot express arithmetic predicates
against another column.
