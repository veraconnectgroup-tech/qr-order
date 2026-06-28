import { NextResponse } from "next/server";
import {
  ERROR_CODES,
  mapStatusToErrorCode,
  type ApiErrorCode,
  type ParsedApiError,
} from "@/lib/api-error-client";
import { getTraceId } from "@/lib/resilience/trace-id";

export {
  ERROR_CODES,
  mapStatusToErrorCode,
  parseApiErrorFromJson,
  readApiErrorMessage,
  type ApiErrorCode,
  type ParsedApiError,
} from "@/lib/api-error-client";

export type ApiErrorBody = {
  ok: false;
  error: {
    code: ApiErrorCode | string;
    message: string;
    traceId?: string;
    retryable: boolean;
  };
};

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
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

function defaultRetryable(status: number, details?: unknown): boolean {
  if (status === 429 || status >= 500) return true;
  if (
    details &&
    typeof details === "object" &&
    "retryable" in details &&
    typeof (details as { retryable?: unknown }).retryable === "boolean"
  ) {
    return (details as { retryable: boolean }).retryable;
  }
  return false;
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json({ ok: true, data, error: null }, { status, headers });
}

/** Unified error envelope — auto-infers error code from message + status. */
export function apiError(
  message: string,
  status = 400,
  details?: unknown,
  headers?: Record<string, string>
) {
  const code = inferLegacyErrorCode(message, status, details);
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      retryable: defaultRetryable(status, details),
      traceId: undefined,
    },
  };

  return NextResponse.json(
    {
      ...body,
      data: null,
      ...(details !== undefined ? { details } : {}),
    },
    { status, headers }
  );
}

export function apiErrorResponse(
  code: ApiErrorCode | string,
  message: string,
  status: number,
  options?: { retryable?: boolean; traceId?: string; headers?: Record<string, string> }
): NextResponse {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      retryable: options?.retryable ?? false,
      traceId: options?.traceId,
    },
  };

  return NextResponse.json(body, {
    status,
    headers: options?.headers,
  });
}

export function rateLimitedResponse(req?: Request): NextResponse {
  const traceId = req ? getTraceId(req) : undefined;
  return apiErrorResponse(
    ERROR_CODES.RATE_LIMITED,
    "Too many requests. Please wait a moment.",
    429,
    { retryable: true, traceId }
  );
}
