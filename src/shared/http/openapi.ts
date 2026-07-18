export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SeatWise API",
    version: "1.0.0",
    description:
      "Versioned JSON API for event discovery, reservations, checkout, tickets, organizer operations, and administration. Protected endpoints use the Better Auth session cookie. Mutating browser requests must be same-origin.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  tags: [
    { name: "Identity" },
    { name: "Events" },
    { name: "Reservations" },
    { name: "Orders" },
    { name: "Tickets" },
    { name: "Organizer" },
    { name: "Administrator" },
    { name: "Operations" },
  ],
  paths: {
    "/api/v1/health/live": {
      get: {
        tags: ["Operations"],
        summary: "Liveness check",
        responses: { "200": { description: "Process is live" } },
      },
    },
    "/api/v1/health/ready": {
      get: {
        tags: ["Operations"],
        summary: "Database readiness check",
        responses: {
          "200": { description: "Application is ready" },
          "500": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/events": {
      get: {
        tags: ["Events"],
        summary: "Search published events",
        parameters: [
          { $ref: "#/components/parameters/Page" },
          { $ref: "#/components/parameters/PageSize" },
          { name: "query", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "city", in: "query", schema: { type: "string" } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["date", "title"] },
          },
        ],
        responses: { "200": { description: "Paginated event collection" } },
      },
    },
    "/api/v1/events/{slug}": {
      get: {
        tags: ["Events"],
        summary: "Get an event and live availability",
        parameters: [{ $ref: "#/components/parameters/Slug" }],
        responses: {
          "200": { description: "Event details" },
          "404": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/reservations": {
      post: {
        tags: ["Reservations"],
        summary: "Atomically reserve assigned seats or GA quantities",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateReservation" },
            },
          },
        },
        responses: {
          "201": { description: "Reservation and authoritative cart totals" },
          "409": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/reservations/{reservationId}": {
      get: {
        tags: ["Reservations"],
        summary: "Get an owned reservation",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ReservationId" }],
        responses: { "200": { description: "Reservation" } },
      },
      delete: {
        tags: ["Reservations"],
        summary: "Release an owned reservation",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ReservationId" }],
        responses: { "200": { description: "Released reservation" } },
      },
    },
    "/api/v1/reservations/{reservationId}/promotion": {
      post: {
        tags: ["Reservations"],
        summary: "Validate and apply a promotion",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ReservationId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: { code: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated authoritative totals" },
          "422": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/checkout": {
      post: {
        tags: ["Orders"],
        summary: "Create and pay an idempotent order",
        description:
          "The same user and Idempotency-Key always resolve to one order and one provider charge. Browser prices and totals are ignored.",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Checkout" },
            },
          },
        },
        responses: {
          "201": { description: "Paid order and issued ticket references" },
          "402": { $ref: "#/components/responses/Error" },
          "409": { $ref: "#/components/responses/Error" },
          "504": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/orders": {
      get: {
        tags: ["Orders"],
        summary: "List the current customer's orders",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Order collection" } },
      },
    },
    "/api/v1/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Get an owned order",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: {
          "200": { description: "Order" },
          "404": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/orders/{orderId}/refunds": {
      post: {
        tags: ["Orders"],
        summary: "Request a policy-eligible refund",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: {
                  reason: { type: "string", minLength: 10, maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Refund request" },
          "409": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "List the current customer's tickets",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Ticket wallet" } },
      },
    },
    "/api/v1/tickets/{ticketId}": {
      get: {
        tags: ["Tickets"],
        summary: "Get an owned ticket",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/TicketId" }],
        responses: {
          "200": { description: "Ticket details and QR token" },
          "404": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/organizer/dashboard": {
      get: {
        tags: ["Organizer"],
        summary: "Get sales and inventory summaries",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Organizer summary" },
          "403": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/organizer/venues": {
      post: {
        tags: ["Organizer"],
        summary: "Create a venue",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Venue" } },
      },
    },
    "/api/v1/organizer/events": {
      post: {
        tags: ["Organizer"],
        summary: "Create an event, schedule, prices, and inventory",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Draft event" } },
      },
    },
    "/api/v1/organizer/promotions": {
      post: {
        tags: ["Organizer"],
        summary: "Create a promotion code",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Promotion" } },
      },
    },
    "/api/v1/admin/users": {
      get: {
        tags: ["Administrator"],
        summary: "List users and organizer status",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "User collection" } },
      },
    },
    "/api/v1/admin/audit": {
      get: {
        tags: ["Administrator"],
        summary: "Search the audit log",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Paginated audit events" } },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        tags: ["Identity"],
        summary: "Create an email and password session",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Authenticated session" },
          "401": { description: "Generic authentication failure" },
        },
      },
    },
    "/api/auth/sign-up/email": {
      post: {
        tags: ["Identity"],
        summary: "Register a customer account",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Registered customer" } },
      },
    },
    "/api/auth/request-password-reset": {
      post: {
        tags: ["Identity"],
        summary: "Request a generic password reset email",
        responses: {
          "200": {
            description: "Accepted whether or not the supplied account exists",
          },
        },
      },
    },
    "/api/v1/organizer/venues/{venueId}/sections": {
      post: {
        tags: ["Organizer"],
        summary: "Add an assigned or general-admission venue section",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/VenueId" }],
        responses: { "201": { description: "Venue section and seat layout" } },
      },
    },
    "/api/v1/organizer/events/{eventId}": {
      patch: {
        tags: ["Organizer"],
        summary: "Edit event schedule, pricing, and GA capacity",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        responses: {
          "200": { description: "Updated event" },
          "409": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/v1/organizer/events/{eventId}/status": {
      post: {
        tags: ["Organizer"],
        summary: "Publish, unpublish, or cancel an owned event",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        responses: { "200": { description: "Updated event state" } },
      },
    },
    "/api/v1/organizer/orders": {
      get: {
        tags: ["Organizer"],
        summary: "List owned event orders and attendees",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Organizer order collection" } },
      },
    },
    "/api/v1/organizer/refunds/{refundRequestId}": {
      post: {
        tags: ["Organizer"],
        summary: "Approve or reject an owned-event refund",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RefundRequestId" }],
        responses: { "200": { description: "Processed refund decision" } },
      },
    },
    "/api/v1/admin/dashboard": {
      get: {
        tags: ["Administrator"],
        summary: "Get system health and resource counts",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Administrator summary" } },
      },
    },
    "/api/v1/admin/users/{userId}/role": {
      patch: {
        tags: ["Administrator"],
        summary: "Change a user's application role",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        responses: { "200": { description: "Updated user role" } },
      },
    },
    "/api/v1/admin/organizers/{organizerId}/status": {
      patch: {
        tags: ["Administrator"],
        summary: "Approve, suspend, or reactivate an organizer",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/OrganizerId" }],
        responses: { "200": { description: "Updated organizer status" } },
      },
    },
    "/api/v1/admin/events": {
      get: {
        tags: ["Administrator"],
        summary: "List events for oversight",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Event oversight collection" } },
      },
    },
    "/api/v1/admin/events/{eventId}/status": {
      post: {
        tags: ["Administrator"],
        summary: "Unpublish or cancel an event",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        responses: { "200": { description: "Moderated event" } },
      },
    },
    "/api/v1/admin/refunds": {
      get: {
        tags: ["Administrator"],
        summary: "List pending refunds across organizers",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Pending refund collection" } },
      },
    },
    "/api/v1/admin/refunds/{refundRequestId}": {
      post: {
        tags: ["Administrator"],
        summary: "Approve or reject any pending refund",
        security: [{ cookieAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/RefundRequestId" }],
        responses: { "200": { description: "Processed refund decision" } },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "seatwise.session_token",
        description: "HttpOnly Better Auth session cookie",
      },
    },
    parameters: {
      Page: {
        name: "page",
        in: "query",
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      PageSize: {
        name: "pageSize",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 12 },
      },
      Slug: {
        name: "slug",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      ReservationId: {
        name: "reservationId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      OrderId: {
        name: "orderId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      TicketId: {
        name: "ticketId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      VenueId: {
        name: "venueId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      EventId: {
        name: "eventId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      UserId: {
        name: "userId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      OrganizerId: {
        name: "organizerId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      RefundRequestId: {
        name: "refundRequestId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", minLength: 8, maxLength: 100 },
      },
    },
    schemas: {
      CreateReservation: {
        type: "object",
        required: ["performanceId"],
        properties: {
          performanceId: { type: "string" },
          seatInventoryIds: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          generalAdmission: {
            type: "array",
            items: {
              type: "object",
              required: ["ticketTypeId", "quantity"],
              properties: {
                ticketTypeId: { type: "string" },
                quantity: { type: "integer", minimum: 1, maximum: 8 },
              },
            },
          },
        },
      },
      Checkout: {
        type: "object",
        required: ["reservationId", "paymentToken"],
        properties: {
          reservationId: { type: "string" },
          paymentToken: {
            type: "string",
            description:
              "Local simulator token: pm_success, pm_decline, pm_timeout, or pm_transient",
          },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      Error: {
        description: "Consistent API error response",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
} as const;
