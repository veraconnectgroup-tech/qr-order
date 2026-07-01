export const APP_NAME = "QR Order";

export const ORDER_STATUSES = [
  "pending_approval",
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
  "pos_online",
  "refunded",
  "partial_refund",
  "failed",
] as const;

export const STAFF_ROLES = [
  "owner",
  "manager",
  "staff",
  "kitchen",
  "waiter",
  "bar",
] as const;

export const ADMIN_ROLES = ["owner", "manager"] as const;

/** Floor staff who can take orders, manage tables, and handle calls. */
export const FLOOR_STAFF_ROLES = [
  "owner",
  "manager",
  "staff",
  "waiter",
] as const;

export const SESSION_MAX_AGE_HOURS = 12;

export const WAITER_CALL_COOLDOWN_SECONDS = 60;

/** Fast poll when Supabase Realtime is unavailable. */
export const REALTIME_FALLBACK_POLL_MS = 5_000;

/** KDS poll interval when Realtime is disconnected. */
export const KDS_REALTIME_FALLBACK_POLL_MS = 10_000;

/** Backup poll while Realtime is connected (catches missed events). */
export const REALTIME_BACKUP_POLL_MS = 10_000;

/** Reconnect when live channel has no events for this long. */
export const REALTIME_STALE_LIVE_MS = 90_000;

/** Watchdog interval for stale live detection. */
export const REALTIME_WATCHDOG_MS = 30_000;

/** Guest Denis view SSE reconnect delay. */
export const REALTIME_SSE_RECONNECT_MS = 1_000;

/** Guest Denis view poll — fallback only when SSE disconnected (ADR-019-E / F6). */
export const GUEST_VIEW_FALLBACK_POLL_MS = 30_000;

/** Party shared-cart sync when Realtime/SSE unavailable. */
export const PARTY_CART_SYNC_POLL_MS = REALTIME_FALLBACK_POLL_MS;

/** @deprecated Use REALTIME_FALLBACK_POLL_MS */
export const DASHBOARD_POLL_INTERVAL_MS = REALTIME_FALLBACK_POLL_MS;

/** Platform fee on card payments (Connect application_fee). */
export const PLATFORM_FEE_FIXED_EUR = 0.4;
export const PLATFORM_FEE_SMALL_ORDER_EUR = 0.2;
export const PLATFORM_FEE_SMALL_ORDER_THRESHOLD_EUR = 10;
/** Guest payment intelligence — recommend card for larger bills (Prompt 47). */
export const PAYMENT_LARGE_ORDER_THRESHOLD_EUR = 50;

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

/** Default Starter pack in `ai_credit_packages` (00046) — marketing copy only. */
export const DENIS_AI_STARTER_CREDITS = 500;
export const DENIS_AI_STARTER_PRICE_EUR = 19;
export const DENIS_AI_CREDITS_PER_TURN = 1;
export const DENIS_AI_LOW_BALANCE_THRESHOLD = 10;

export function denisAiCreditsMarketingEn(currency = "EUR") {
  const sym = currency === "EUR" ? "€" : `${currency} `;
  return {
    starterLabel: `${DENIS_AI_STARTER_CREDITS.toLocaleString("en-GB")} credits from ${sym}${DENIS_AI_STARTER_PRICE_EUR}`,
    perTurn: `${DENIS_AI_CREDITS_PER_TURN} credit per AI-assisted guest message`,
    browseFree: "Menu browse without AI is free",
    lowBalance: `Staff alert when balance drops to ${DENIS_AI_LOW_BALANCE_THRESHOLD} credits or below`,
  };
}

export const PAYMENT_METHODS = [
  "unset",
  "online",
  "at_bar",
  "card_at_table",
  "card_terminal",
  "pos",
  "pos_online",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_SOURCES = ["qr", "staff", "kiosk", "pos"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const IN_PERSON_PAYMENT_LOCATIONS = ["bar", "counter", "table"] as const;
export type InPersonPaymentLocation = (typeof IN_PERSON_PAYMENT_LOCATIONS)[number];
