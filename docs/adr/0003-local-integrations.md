# ADR 0003: Put local payment and email behind interfaces

Status: accepted

## Context

The application must exercise realistic payment state transitions and email
workflows without paid external services. Domain services should remain
testable and should not depend on a simulator-specific API.

## Decision

Define `PaymentProvider` and `EmailSender` interfaces in their owning modules.
The local payment provider returns deterministic outcomes from opaque test
tokens and stable references from idempotency keys. The SMTP sender delivers to
Mailpit.

Persist payment attempts, provider references, notification intent, and
delivery outcomes independently of the adapters. Never store a payment token.
Inject providers, clocks, and identifier generators into services that need
deterministic tests.

## Consequences

Local development exercises success and failure paths without external
accounts. A hosted payment or email adapter can replace the local implementation
without changing route handlers or core order policy. The simulator does not
model asynchronous webhooks or disputed charges; a hosted provider adapter must
add signed webhook handling and reconciliation while preserving the order
state machine.
