import type { OrderFact } from "@/lib/denis/loop/types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const WAITING_STATUSES = ["pending", "accepted", "preparing"] as const;

export type CommerceLifecycleFacts = {
  oldestWaitMinutes: number;
  anyLate: boolean;
  kitchenEtaMinutes: number | null;
  barEtaMinutes: number | null;
  allDelivered: boolean;
  oldestWaitingOrder: OrderFact | null;
};

function isWaitingStatus(status: string): boolean {
  return (WAITING_STATUSES as readonly string[]).includes(status);
}

function orderWaitMinutes(order: OrderFact, nowMs: number): number {
  const sinceMs = new Date(order.createdAt).getTime();
  if (!Number.isFinite(sinceMs)) return 0;
  return Math.max(0, Math.round((nowMs - sinceMs) / 60_000));
}

function stationEtaMinutes(
  ops: VenueOpsBeliefs,
  station: "kitchen" | "bar"
): number | null {
  const row = (ops.stationStress ?? []).find((entry) => entry.station === station);
  return row?.avgWaitMinutes ?? null;
}

/** Pure fold — commerce lifecycle from orders + station stress (A3). */
export function deriveCommerceLifecycleFacts(
  orders: OrderFact[],
  venueOps: VenueOpsBeliefs,
  nowMs = Date.now()
): CommerceLifecycleFacts {
  const waitingOrders = orders.filter((order) => isWaitingStatus(order.status));

  let oldestWaitingOrder: OrderFact | null = null;
  let oldestWaitMinutes = 0;

  for (const order of waitingOrders) {
    const waitMinutes = orderWaitMinutes(order, nowMs);
    if (!oldestWaitingOrder || waitMinutes >= oldestWaitMinutes) {
      oldestWaitingOrder = order;
      oldestWaitMinutes = waitMinutes;
    }
  }

  let anyLate = false;
  for (const order of waitingOrders) {
    const waitMinutes = orderWaitMinutes(order, nowMs);
    const eta = order.estimatedPrepMinutes;
    if (eta != null && waitMinutes > eta * 1.3) {
      anyLate = true;
      break;
    }
  }

  const allDelivered =
    orders.length > 0 &&
    orders.every((order) => order.status === "delivered");

  return {
    oldestWaitMinutes,
    anyLate,
    kitchenEtaMinutes: stationEtaMinutes(venueOps, "kitchen"),
    barEtaMinutes: stationEtaMinutes(venueOps, "bar"),
    allDelivered,
    oldestWaitingOrder,
  };
}

export function formatCommerceGuestWaitingLine(
  facts: CommerceLifecycleFacts
): string | null {
  if (!facts.oldestWaitingOrder || facts.oldestWaitMinutes <= 0) {
    return null;
  }

  const order = facts.oldestWaitingOrder;
  const number = order.orderNumber ?? "?";
  const eta =
    order.estimatedPrepMinutes != null
      ? `ETA was ~${order.estimatedPrepMinutes} min`
      : "ETA unknown";

  const statusNote = facts.anyLate
    ? "LATE, empathy needed"
    : order.estimatedPrepMinutes != null
      ? "on track"
      : "waiting";

  return `- guest_waiting: ${facts.oldestWaitMinutes} min (order #${number} ${order.status}, ${eta} — ${statusNote})`;
}
