# ADR 0001: Use a modular monolith

Status: accepted

## Context

SeatWise has several business domains but one team, one transactional database,
and workflows that cross inventory, pricing, orders, payments, and tickets.
Independent services would add network failure modes and distributed
transaction requirements without an operational need.

## Decision

Use one Next.js deployment and one PostgreSQL database. Organize application
code into bounded modules under `src/modules`. App Router files compose the UI
and HTTP boundary; they do not own business rules.

Modules expose focused application services. Shared code is limited to
cross-domain infrastructure and primitives. Replaceable external behavior uses
narrow interfaces where deterministic tests or deployment adapters provide
concrete value.

## Consequences

Checkout and reservation invariants can use one database transaction. Local
setup, logs, deployment, and debugging remain straightforward. Module
boundaries are conventions enforced by review rather than network boundaries.
If independent scaling becomes measurable later, a module can be extracted
behind its existing application interface.
