import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { OrderFact } from "@/lib/denis/loop/types";

/** Merge FOLD prep ETA onto AI guest orders for proactive triggers (B1). */
export function enrichAiOrdersFromFold(
  orders: AiGuestOrder[],
  foldOrders: OrderFact[]
): AiGuestOrder[] {
  const byId = new Map(foldOrders.map((order) => [order.id, order]));

  return orders.map((order) => {
    const fact = byId.get(order.id);
    if (!fact) return order;

    return {
      ...order,
      estimated_prep_minutes: fact.estimatedPrepMinutes,
      prep_estimate_confidence: fact.prepEstimateConfidence ?? "none",
    };
  });
}
