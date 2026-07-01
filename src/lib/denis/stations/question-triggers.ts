import type { ConciergeStationQuestions } from "@/lib/denis/config/concierge-config.schema";

export type StationQuestionStation = "kitchen" | "bar";

export type StationQuestionType =
  | "eta"
  | "pending_accept"
  | "ready_pickup"
  | "mixed_conflict";

export type StationQuestionSourceEvent =
  | "guest_ask"
  | "sla_breach"
  | "manager"
  | "mixed_conflict"
  | "pending_too_long"
  | "ready_not_picked";

export type StationTriggerOrder = {
  id: string;
  orderNumber: number | null;
  status: string;
  createdAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  hasKitchenItems: boolean;
  hasDrinkItems: boolean;
};

export type StationQuestionCandidate = {
  orderId: string;
  orderNumber: number | null;
  station: StationQuestionStation;
  questionType: StationQuestionType;
  sourceEvent: StationQuestionSourceEvent;
  waitMinutes: number;
};

function minutesSince(iso: string | null, now: number): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0;
  return Math.floor((now - ts) / 60_000);
}

/** Which station Denis asks about this order (kitchen wins for mixed orders). */
export function stationForOrder(order: {
  hasKitchenItems: boolean;
  hasDrinkItems: boolean;
}): StationQuestionStation {
  return order.hasKitchenItems ? "kitchen" : "bar";
}

/**
 * Watcher trigger rules (T2 SLA / T4 mixed / T5 pending / T6 ready-not-picked).
 * Pure — anti-spam (open/cooldown/cap) is enforced at create time.
 */
export function evaluateStationQuestionTriggers(input: {
  orders: StationTriggerOrder[];
  config: ConciergeStationQuestions;
  now?: number;
}): StationQuestionCandidate[] {
  const now = input.now ?? Date.now();
  const candidates: StationQuestionCandidate[] = [];

  for (const order of input.orders) {
    if (!order.hasKitchenItems && !order.hasDrinkItems) continue;

    if (order.status === "pending" || order.status === "pending_approval") {
      const wait = minutesSince(order.createdAt, now);
      if (wait >= input.config.pendingAcceptMinutes) {
        candidates.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: stationForOrder(order),
          questionType: "pending_accept",
          sourceEvent: "pending_too_long",
          waitMinutes: wait,
        });
      }
      continue;
    }

    if (order.status === "accepted" || order.status === "preparing") {
      const wait = minutesSince(order.createdAt, now);

      if (order.hasKitchenItems && wait >= input.config.foodSlaMinutes) {
        candidates.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: "kitchen",
          questionType: "eta",
          sourceEvent: "sla_breach",
          waitMinutes: wait,
        });
        continue;
      }

      if (order.hasDrinkItems && wait >= input.config.drinkSlaMinutes) {
        if (order.hasKitchenItems) {
          // Mixed order: drinks should already be out while food still cooks.
          candidates.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            station: "bar",
            questionType: "mixed_conflict",
            sourceEvent: "mixed_conflict",
            waitMinutes: wait,
          });
        } else {
          candidates.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            station: "bar",
            questionType: "eta",
            sourceEvent: "sla_breach",
            waitMinutes: wait,
          });
        }
      }
      continue;
    }

    if (order.status === "ready") {
      const wait = minutesSince(order.readyAt ?? order.createdAt, now);
      if (wait >= input.config.readyPickupMinutes) {
        candidates.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          station: stationForOrder(order),
          questionType: "ready_pickup",
          sourceEvent: "ready_not_picked",
          waitMinutes: wait,
        });
      }
    }
  }

  return candidates;
}

const STATION_LABEL_SR: Record<StationQuestionStation, string> = {
  kitchen: "kuhinju",
  bar: "bar",
};

/** Staff-facing card copy (Serbian, matching KDS/bar surfaces). */
export function buildStationQuestionMessage(input: {
  questionType: StationQuestionType;
  station: StationQuestionStation;
  tableName: string;
  orderNumber: number | null;
  waitMinutes: number;
}): string {
  const bon = input.orderNumber != null ? `Bon #${input.orderNumber}` : "Bon";
  const table = `Sto ${input.tableName}`;

  switch (input.questionType) {
    case "pending_accept":
      return `${table} · ${bon} čeka ${input.waitMinutes} min bez prihvatanja. Kreće li priprema?`;
    case "ready_pickup":
      return `${table} · ${bon} je spreman ${input.waitMinutes} min. Da li je preuzet?`;
    case "mixed_conflict":
      return `${table} čeka piće ${input.waitMinutes} min (hrana se sprema). Da li je piće izašlo?`;
    case "eta":
      return `${table} · ${bon} — gost čeka ${input.waitMinutes} min. Kada je gotovo?`;
  }
}

/** Who is Denis asking — used in strip header. */
export function stationQuestionAskLabel(station: StationQuestionStation): string {
  return `Denis pita ${STATION_LABEL_SR[station]}`;
}
