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
