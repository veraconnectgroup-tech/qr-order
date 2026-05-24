import type { OrderCreateError, OrderCreateErrorCode } from "@/lib/orders/create/result";

export function orderError(
  code: OrderCreateErrorCode,
  message: string,
  status: number,
  details?: OrderCreateError["details"]
): OrderCreateError {
  return { code, message, status, ...(details ? { details } : {}) };
}

export function toLegacyOrderError(error: OrderCreateError) {
  return {
    error: error.message,
    status: error.status,
    ...(error.details?.products ? { products: error.details.products } : {}),
    ...(error.details?.blockedUntil
      ? { blockedUntil: error.details.blockedUntil }
      : {}),
  };
}

export const toApi = toLegacyOrderError;

export function sessionValidationError(
  error: string,
  status: number
): OrderCreateError {
  if (error === "Session expired or invalid") {
    return orderError("session_expired", error, status);
  }
  if (error === "Invalid QR code") {
    return orderError("invalid_qr", error, status);
  }
  if (error === "Session required." || error === "Session required") {
    return orderError("session_required", error, status);
  }
  if (error === "no_active_session") {
    return orderError("session_expired", error, status);
  }
  if (error === "invalid_pin") {
    return orderError("pin_required", error, status);
  }
  if (error === "pin_required") {
    return orderError("pin_required", error, status);
  }
  if (status === 403 && error.includes("ordering")) {
    return orderError("ordering_paused", error, status);
  }
  return orderError("internal", error, status);
}
