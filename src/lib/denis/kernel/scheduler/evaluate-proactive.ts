import type {
  ProactiveEvaluation,
  ProactiveTriggerKind,
  ScheduledIntentType,
  SchedulerOrderSnapshot,
} from "@/lib/denis/kernel/scheduler/types";

const MS_MINUTE = 60_000;

function minutesAgo(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / MS_MINUTE;
}

function formatOrderItems(order: SchedulerOrderSnapshot): string {
  return order.order_items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
      return `${qty}${item.product_name}`;
    })
    .join(", ");
}

function hasDessert(orders: SchedulerOrderSnapshot[]) {
  return orders.some((order) =>
    order.order_items.some((item) => item.menu_section === "desserts")
  );
}

function evaluatePairing(
  orders: SchedulerOrderSnapshot[],
  orderId: string | undefined,
  shownKeys: Set<string>,
  now: number
): ProactiveEvaluation | null {
  if (!orderId || shownKeys.has(`pairing:${orderId}`)) return null;
  const order = orders.find((row) => row.id === orderId);
  if (!order?.order_items.length) return null;
  if (!["pending", "accepted"].includes(order.status)) return null;
  if (minutesAgo(order.created_at, now) > 5) return null;

  return {
    kind: "pairing",
    orderId,
    message: `Uz ${formatOrderItems(order)} predlažem jedno piće — da pogledate?`,
    templateTier: "T1",
  };
}

function evaluateDessert(
  orders: SchedulerOrderSnapshot[],
  afterOrderId: string | undefined,
  shownKeys: Set<string>,
  now: number
): ProactiveEvaluation | null {
  if (shownKeys.has("dessert")) return null;
  if (hasDessert(orders)) return null;

  const delivered = orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );

  const target = afterOrderId
    ? delivered.find((order) => order.id === afterOrderId)
    : delivered[0];
  if (!target) return null;

  const reference = target.delivered_at ?? target.created_at;
  const mins = minutesAgo(reference, now);
  if (mins < 10) return null;

  return {
    kind: "dessert",
    message: "Spremni za desert? Imam par odličnih predloga.",
    templateTier: "T1",
  };
}

function evaluateSlowKitchen(
  orders: SchedulerOrderSnapshot[],
  orderId: string | undefined,
  shownKeys: Set<string>,
  now: number,
  thresholdMinutes: number
): ProactiveEvaluation | null {
  if (!orderId || shownKeys.has(`slow_kitchen:${orderId}`)) return null;
  const order = orders.find((row) => row.id === orderId);
  if (!order) return null;
  if (!["pending", "accepted", "preparing"].includes(order.status)) return null;

  const mins = minutesAgo(order.created_at, now);
  if (mins < thresholdMinutes) return null;

  return {
    kind: "slow_kitchen",
    orderId,
    message: `Kuhinja radi intenzivno — vaša narudžbina traje oko ${Math.floor(mins)} min. Želite nešto da popijete dok čekate?`,
    templateTier: "T1",
  };
}

export type EvaluateScheduledIntentInput = {
  intentType: ScheduledIntentType;
  payload: { orderId?: string; afterOrderId?: string; minutesWaiting?: number };
  orders: SchedulerOrderSnapshot[];
  shownNudgeKeys: string[];
  slowKitchenThresholdMinutes: number;
  now?: number;
};

/** Evaluate one due schedule — deterministic T1 templates (no LLM). */
export function evaluateScheduledIntent(
  input: EvaluateScheduledIntentInput
): ProactiveEvaluation | null {
  const now = input.now ?? Date.now();
  const shown = new Set(input.shownNudgeKeys);

  switch (input.intentType) {
    case "EVALUATE_PAIRING":
      return evaluatePairing(input.orders, input.payload.orderId, shown, now);
    case "DESSERT_UPSELL":
      return evaluateDessert(
        input.orders,
        input.payload.afterOrderId,
        shown,
        now
      );
    case "SLOW_KITCHEN_CHECK":
      return evaluateSlowKitchen(
        input.orders,
        input.payload.orderId,
        shown,
        now,
        input.payload.minutesWaiting ?? input.slowKitchenThresholdMinutes
      );
    case "REVIEW_PROMPT":
    case "STATUS_FOLLOWUP":
      return null;
    default:
      return null;
  }
}

export function proactiveKindFromIntent(
  intentType: ScheduledIntentType
): ProactiveTriggerKind | null {
  switch (intentType) {
    case "EVALUATE_PAIRING":
      return "pairing";
    case "DESSERT_UPSELL":
      return "dessert";
    case "SLOW_KITCHEN_CHECK":
      return "slow_kitchen";
    default:
      return null;
  }
}
