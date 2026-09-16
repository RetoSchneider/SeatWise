# REST API conventions

The primary application API is versioned under `/api/v1`. Better Auth mounts
its standard protocol endpoints under `/api/auth`; those routes are intentionally
not duplicated inside the business API.

The machine-readable OpenAPI 3.1 document is available at
`/api/v1/openapi`. `/docs/api` renders a local human-readable endpoint index.

## Envelopes

Successful responses contain `data` and may include pagination `meta`:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 12,
    "total": 0,
    "totalPages": 1
  }
}
```

Errors use stable codes and a request identifier:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      {
        "path": "paymentToken",
        "message": "Required"
      }
    ],
    "requestId": "f26c820a-23f1-48da-8f6f-575486325e2b"
  }
}
```

Authentication errors are intentionally generic. Internal exceptions,
credentials, payment tokens, cookies, and database details are not returned.

## Authentication and authorization

Protected browser endpoints use the HttpOnly Better Auth session cookie.
Authorization is performed in application routes and services:

- customer resources are scoped by the authenticated user ID
- organizer resources are scoped through the active organizer profile
- administrator operations require `ADMINISTRATOR`
- hiding a UI control never grants or removes server permission

Mutating requests validate `Origin` when supplied and reject cross-site Fetch
Metadata. Better Auth applies its own origin validation and secure cookie
defaults to authentication routes.

## Idempotency

`POST /api/v1/checkout` requires an `Idempotency-Key` header from 8 to 100
characters. Keys are scoped to the current user. The first request establishes
the order and payment attempt; repeated requests return or continue that same
state and never create a second order for the key. New orders store a hash of
the validated checkout request and reject the same key with different inputs.

A lost browser response is retried with the same key. A failed payment is durable. A deliberate retry uses a new key while the
reservation is still active. Provider references and attempts are retained for
auditability; payment simulator tokens are not stored.

## Status codes

- `200` — successful read or state change
- `201` — resource created
- `400` — malformed JSON or a missing required protocol header
- `401` — session required
- `402` — payment declined
- `403` — role, ownership, or same-origin check failed
- `404` — resource absent or outside the caller's ownership scope
- `409` — inventory, expiry, idempotency, or state conflict
- `422` — structurally valid request that violates validation or promotion rules
- `429` — endpoint rate limit exceeded
- `500` — unexpected internal error
- `503` — transient payment provider failure
- `504` — payment provider timeout

## Pagination

Collection endpoints use one-based `page` and bounded `pageSize` query
parameters. The maximum page size is 100. Pagination metadata always reports
the total matching resource count and total pages.

## Simulator values

Use `pm_success`, `pm_decline`, `pm_timeout`, or `pm_transient` as the
`paymentToken` in local checkout. These values represent opaque provider tokens,
not card details.
