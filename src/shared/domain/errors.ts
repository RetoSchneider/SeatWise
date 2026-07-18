export type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RESERVATION_EXPIRED"
  | "INVENTORY_UNAVAILABLE"
  | "PROMOTION_INVALID"
  | "PAYMENT_DECLINED"
  | "PAYMENT_TIMEOUT"
  | "PAYMENT_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class ApplicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function notFound(message: string) {
  return new ApplicationError("NOT_FOUND", message, 404);
}

export function forbidden(message = "You do not have access to this resource") {
  return new ApplicationError("FORBIDDEN", message, 403);
}

export function conflict(code: ErrorCode, message: string, details?: unknown) {
  return new ApplicationError(code, message, 409, details);
}
