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

export const WAITER_CALL_COOLDOWN_SECONDS = 60;

/** Fast poll when Supabase Realtime is unavailable. */
export const REALTIME_FALLBACK_POLL_MS = 3_000;

/** KDS poll interval when Realtime is disconnected. */
export const KDS_REALTIME_FALLBACK_POLL_MS = 10_000;

/** Safety poll while Realtime is connected (missed events). */
export const REALTIME_BACKUP_POLL_MS = 45_000;

/** @deprecated Use REALTIME_FALLBACK_POLL_MS */
export const DASHBOARD_POLL_INTERVAL_MS = REALTIME_FALLBACK_POLL_MS;

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
  return platformFeeDescriptionEn(currency);
}

export function platformFeeDescriptionEn(currency = "EUR") {
  const { small, large, threshold } = platformFeeParts(currency);
  return `${small} per order under ${threshold}, ${large} per order from ${threshold} upward`;
}

export const PAYMENT_METHODS = ["unset", "online", "at_bar", "card_at_table"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const IN_PERSON_PAYMENT_LOCATIONS = ["bar", "counter", "table"] as const;
export type InPersonPaymentLocation = (typeof IN_PERSON_PAYMENT_LOCATIONS)[number];
