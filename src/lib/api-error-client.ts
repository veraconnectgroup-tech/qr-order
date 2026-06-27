/** Client-safe API error parsing — no Node/server dependencies. */

export const ERROR_CODES = {
  RATE_LIMITED: "rate_limited",
  CART_EMPTY: "cart_empty",
  SESSION_EXPIRED: "session_expired",
  CIRCUIT_OPEN: "circuit_open",
  CREDIT_EXHAUSTED: "credit_exhausted",
  INVALID_INPUT: "invalid_input",
  MODERATION_BLOCKED: "moderation_blocked",
  PAYMENT_FAILED: "payment_failed",
  ORDER_CONFLICT: "order_conflict",
  LOCATION_CLOSED: "location_closed",
  INTERNAL: "internal_error",
  UNAUTHORIZED: "unauthorized",
} as const;

export type ApiErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ParsedApiError = {
  code: string;
  message: string;
  retryable: boolean;
  traceId?: string;
  details?: unknown;
};

const ORDER_BUSINESS_CODES = new Set([
  "pin_required",
  "device_blocked",
  "awaiting_approval",
  "unavailable_products",
  "invalid_pin",
  "session_required",
  "ordering_paused",
]);

export function mapStatusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status === 400) return ERROR_CODES.INVALID_INPUT;
  return ERROR_CODES.INTERNAL;
}

function inferLegacyErrorCode(
  message: string,
  status: number,
  details: unknown
): string {
  if (ORDER_BUSINESS_CODES.has(message)) return message;

  const detailsCode =
    details &&
    typeof details === "object" &&
    "code" in details &&
    typeof (details as { code?: unknown }).code === "string"
      ? (details as { code: string }).code
      : null;

  if (detailsCode === "not_configured") return ERROR_CODES.CIRCUIT_OPEN;
  if (message === "insufficient_credits") return ERROR_CODES.CREDIT_EXHAUSTED;
  if (
    status === 401 ||
    status === 410 ||
    message.includes("Session expired") ||
    message.includes("no longer active") ||
    message.includes("message limit") ||
    message.includes("Session does not match")
  ) {
    return ERROR_CODES.SESSION_EXPIRED;
  }
  if (status === 429 || message.includes("Too many requests")) {
    return ERROR_CODES.RATE_LIMITED;
  }
  if (
    status === 503 ||
    message.includes("not available") ||
    message.includes("not configured")
  ) {
    return ERROR_CODES.CIRCUIT_OPEN;
  }
  if (status === 400 && message.includes("could not be processed")) {
    return ERROR_CODES.MODERATION_BLOCKED;
  }
  if (
    message.includes("Already paid") ||
    message.includes("already paid") ||
    message.includes("Payment already in progress") ||
    message.includes("Split already configured")
  ) {
    return ERROR_CODES.ORDER_CONFLICT;
  }
  if (
    message.includes("Payment could not") ||
    message.includes("Checkout could not") ||
    message.includes("Payment failed")
  ) {
    return ERROR_CODES.PAYMENT_FAILED;
  }
  if (message.includes("Cart is empty") || message.includes("cart empty")) {
    return ERROR_CODES.CART_EMPTY;
  }
  if (status === 403 || message === "Forbidden.") {
    return ERROR_CODES.UNAUTHORIZED;
  }
  if (status === 404 || message.includes("not found")) {
    return ERROR_CODES.INVALID_INPUT;
  }
  return mapStatusToErrorCode(status);
}

export function parseApiErrorFromJson(
  json: unknown,
  fallbackStatus = 500
): ParsedApiError | null {
  if (!json || typeof json !== "object") return null;
  const body = json as Record<string, unknown>;

  if (body.ok === false && body.error && typeof body.error === "object") {
    const err = body.error as Record<string, unknown>;
    return {
      code: String(err.code ?? mapStatusToErrorCode(fallbackStatus)),
      message: String(err.message ?? "Something went wrong."),
      retryable: Boolean(err.retryable),
      traceId: typeof err.traceId === "string" ? err.traceId : undefined,
      details: body.details,
    };
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return {
      code: inferLegacyErrorCode(body.error, fallbackStatus, body.details),
      message: body.error,
      retryable: fallbackStatus === 429,
      details: body.details,
    };
  }

  return null;
}

export function readApiErrorMessage(
  json: unknown,
  status = 500,
  fallback = "Something went wrong."
): string {
  return parseApiErrorFromJson(json, status)?.message ?? fallback;
}
