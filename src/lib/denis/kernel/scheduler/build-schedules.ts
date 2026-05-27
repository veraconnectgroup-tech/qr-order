import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type {
  ScheduledIntentDraft,
  SchedulerOrderSnapshot,
} from "@/lib/denis/kernel/scheduler/types";

const MS_MINUTE = 60_000;

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * MS_MINUTE).toISOString();
}

/** Build anticipation jobs from table orders + config (pure). */
export function buildScheduleDrafts(input: {
  orders: SchedulerOrderSnapshot[];
  config: Pick<ConciergeConfig, "proactive" | "upsell">;
  now?: Date;
}): ScheduledIntentDraft[] {
  const now = input.now ?? new Date();
  const drafts: ScheduledIntentDraft[] = [];
  const proactive = input.config.proactive;

  if (!proactive.enabled) {
    return drafts;
  }

  for (const order of input.orders) {
    if (proactive.pairing && ["pending", "accepted"].includes(order.status)) {
      drafts.push({
        intentType: "EVALUATE_PAIRING",
        runAt: addMinutes(order.created_at, 2),
        dedupeKey: `pairing:${order.id}`,
        payload: { orderId: order.id },
      });
    }

    if (
      proactive.slowKitchen &&
      ["pending", "accepted", "preparing"].includes(order.status)
    ) {
      drafts.push({
        intentType: "SLOW_KITCHEN_CHECK",
        runAt: addMinutes(
          order.created_at,
          proactive.slowKitchenThresholdMinutes
        ),
        dedupeKey: `slow_kitchen:${order.id}`,
        payload: {
          orderId: order.id,
          minutesWaiting: proactive.slowKitchenThresholdMinutes,
        },
      });
    }

    if (
      input.config.upsell.dessertAfterDelivered &&
      proactive.dessert &&
      order.status === "delivered"
    ) {
      const reference = order.delivered_at ?? order.created_at;
      drafts.push({
        intentType: "DESSERT_UPSELL",
        runAt: addMinutes(reference, input.config.upsell.dessertDelayMinutes),
        dedupeKey: `dessert:${order.id}`,
        payload: { afterOrderId: order.id },
      });
    }

    if (proactive.reviewPrompt && order.status === "delivered") {
      const reference = order.delivered_at ?? order.created_at;
      drafts.push({
        intentType: "REVIEW_PROMPT",
        runAt: addMinutes(reference, 45),
        dedupeKey: `review:${order.id}`,
        payload: { afterOrderId: order.id },
      });
    }
  }

  return drafts.filter((draft) => new Date(draft.runAt).getTime() > now.getTime());
}
