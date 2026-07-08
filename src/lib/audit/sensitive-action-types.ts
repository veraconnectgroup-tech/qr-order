/** ADR-044 — standardized sensitive action journal types. */

export const SENSITIVE_ACTIONS = [
  "void",
  "discount",
  "transfer",
  "split",
  "merge",
  "refund",
  "price_override",
  "manager_override",
  "payment_mismatch",
  "session_close",
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export const SENSITIVE_TARGET_TYPES = [
  "order",
  "order_item",
  "session",
  "payment",
] as const;

export type SensitiveTargetType = (typeof SENSITIVE_TARGET_TYPES)[number];

export type SensitiveActionContext = Record<string, unknown>;

export type SensitiveActionResolution = "ok" | "problem";

export type SensitiveActionRow = {
  id: string;
  order_id: string | null;
  session_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  sensitive_action: SensitiveAction | null;
  target_type: SensitiveTargetType | null;
  target_id: string | null;
  reason: string | null;
  approved_by_staff_id: string | null;
  risk_flag: boolean;
  context: SensitiveActionContext;
  actor_type: string | null;
  actor_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_outcome: SensitiveActionResolution | null;
  resolved_by_staff_id: string | null;
};
