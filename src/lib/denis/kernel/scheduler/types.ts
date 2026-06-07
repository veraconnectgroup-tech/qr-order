/** Anticipation scheduler types (ADR-004 §9). */

export type ScheduledIntentType =
  | "EVALUATE_PAIRING"
  | "DESSERT_UPSELL"
  | "SLOW_KITCHEN_CHECK"
  | "REVIEW_PROMPT"
  | "STATUS_FOLLOWUP";

export type ScheduledIntentPayload = {
  orderId?: string;
  afterOrderId?: string;
  minutesWaiting?: number;
};

export type ScheduledIntentDraft = {
  intentType: ScheduledIntentType;
  runAt: string;
  dedupeKey: string;
  payload: ScheduledIntentPayload;
};

export type SchedulerOrderItem = {
  product_name: string;
  quantity: number;
  menu_section: string;
};

export type SchedulerOrderSnapshot = {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  order_items: SchedulerOrderItem[];
};

export type ProactiveTriggerKind =
  | "pairing"
  | "dessert"
  | "slow_kitchen";

export type ProactiveEvaluation = {
  kind: ProactiveTriggerKind | (string & {});
  orderId?: string;
  message: string;
  templateTier: "T1" | "template";
};

export type DenisScheduleRow = {
  id: string;
  ai_session_id: string;
  location_id: string;
  intent_type: ScheduledIntentType;
  run_at: string;
  payload: ScheduledIntentPayload;
  status: "pending" | "processing" | "completed" | "cancelled";
  dedupe_key: string;
  created_at: string;
  processed_at: string | null;
};

export type ScheduleTickResult = {
  processed: number;
  emitted: number;
  nudges: ProactiveEvaluation[];
};
