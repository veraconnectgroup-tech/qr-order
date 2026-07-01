export type OrderCreateErrorCode =
  | "invalid_input"
  | "invalid_qr"
  | "session_required"
  | "session_expired"
  | "device_blocked"
  | "awaiting_approval"
  | "pin_required"
  | "unavailable_products"
  | "price_mismatch"
  | "promo_invalid"
  | "ordering_paused"
  | "payment_method_unavailable"
  | "session_closing"
  | "rate_limited"
  | "internal";

export type OrderCreateError = {
  code: OrderCreateErrorCode;
  message: string;
  status: number;
  details?: {
    products?: string[];
    blockedUntil?: string;
  };
};

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
