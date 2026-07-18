import { randomUUID } from "node:crypto";

import { ZodError } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { env } from "@/shared/config/env";
import { ApplicationError } from "@/shared/domain/errors";
import { logger } from "@/shared/infrastructure/logger";

interface ApiResult<T> {
  data: T;
  status?: number;
  meta?: Record<string, unknown>;
  headers?: HeadersInit;
}

export async function handleApiRequest<T>(
  request: Request,
  handler: () => Promise<ApiResult<T>>,
) {
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId =
    incomingRequestId && /^[a-zA-Z0-9_-]{8,80}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  try {
    enforceSameOrigin(request);
    const result = await handler();
    const responseHeaders = new Headers(result.headers);
    responseHeaders.set("x-request-id", requestId);
    return Response.json(
      {
        data: result.data,
        ...(result.meta ? { meta: result.meta } : {}),
      },
      {
        status: result.status ?? 200,
        headers: responseHeaders,
      },
    );
  } catch (error) {
    const response = translateError(error, requestId);
    logger[response.status >= 500 ? "error" : "warn"](
      {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        code: response.code,
        status: response.status,
      },
      response.status >= 500 ? "API request failed" : "API request rejected",
    );

    return Response.json(
      {
        error: {
          code: response.code,
          message: response.message,
          ...(response.details ? { details: response.details } : {}),
          requestId,
        },
      },
      {
        status: response.status,
        headers: { "x-request-id": requestId },
      },
    );
  }
}

function enforceSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return;
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const trustedOrigins = new Set([
    new URL(env.BETTER_AUTH_URL).origin,
    ...env.TRUSTED_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ]);

  if (
    (origin && !trustedOrigins.has(origin)) ||
    (!origin && fetchSite === "cross-site")
  ) {
    throw new ApplicationError("FORBIDDEN", "Cross-site request rejected", 403);
  }
}

function translateError(error: unknown, requestId: string) {
  if (error instanceof ApplicationError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "The request contains invalid data",
      status: 422,
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      code: "CONFLICT",
      message: "The resource already exists",
      status: 409,
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return {
      code: "INVENTORY_UNAVAILABLE",
      message:
        "Inventory changed during this request. Refresh availability and try again.",
      status: 409,
    };
  }

  logger.error({ requestId, error }, "Unhandled API error");
  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  };
}

export async function parseJson<T>(
  request: Request,
  schema: { parse(value: unknown): T },
) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Request body must be valid JSON",
      400,
    );
  }
  return schema.parse(value);
}
