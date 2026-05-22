export const APP_NAME = "QR Order";

export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
  "rejected",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "refunded",
  "partial_refund",
  "failed",
] as const;

export const STAFF_ROLES = ["owner", "manager", "staff", "kitchen"] as const;

export const ADMIN_ROLES = ["owner", "manager"] as const;

export const SESSION_MAX_AGE_HOURS = 4;

export const ORDER_RATE_LIMIT_SECONDS = 60;

export const WAITER_CALL_COOLDOWN_SECONDS = 60;

/** Fallback poll when Supabase Realtime is unavailable. */
export const DASHBOARD_POLL_INTERVAL_MS = 15_000;

/** Platform fee on card payments (Connect application_fee). */
export const PLATFORM_FEE_FIXED_EUR = 0.4;
export const PLATFORM_FEE_SMALL_ORDER_EUR = 0.2;
export const PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR = 10;

function platformFeeParts(currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency + " ";
  return {
    sym,
    small: `${sym}${PLATFORM_FEE_SMALL_ORDER_EUR.toFixed(2)}`,
    large: `${sym}${PLATFORM_FEE_FIXED_EUR.toFixed(2)}`,
    threshold: `${sym}${PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR}`,
  };
}

export function platformFeeDescription(currency = "EUR") {
  const { small, large, threshold } = platformFeeParts(currency);
  return `${small} po porudžbini ispod ${threshold}, ${large} po porudžbini od ${threshold} naviše`;
}

export function platformFeeDescriptionEn(currency = "EUR") {
  const { small, large, threshold } = platformFeeParts(currency);
  return `${small} per order under ${threshold}, ${large} per order from ${threshold} upward`;
}
