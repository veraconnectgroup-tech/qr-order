import { deriveCommerceLifecycleFacts } from "@/lib/denis/cognition/beliefs/compile-commerce-lifecycle";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { OrderFact, OrderStationFact } from "@/lib/denis/loop/types";
import type { FreshStationAnswer } from "@/lib/denis/stations/station-question-messages";
import type { StationQuestionStation } from "@/lib/denis/stations/question-triggers";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";
import { isBarMenuSection, isKitchenMenuSection } from "@/lib/kitchen/menu-section";

const WAITING_STATUSES: readonly string[] = [
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
];

export type GuestStatusScenario =
  | "no_open_order"
  | "bar_answered"
  | "just_placed"
  | "in_progress"
  | "ready_at_station"
  | "queue_busy"
  | "needs_station_check";

export type GuestStatusIntel = {
  scenario: GuestStatusScenario;
  primaryOrder: OrderFact | null;
  waitMinutes: number;
  targetStation: StationQuestionStation | null;
  barActiveOrders: number;
  barStress: string | null;
  barAvgWaitMinutes: number | null;
  kitchenActiveOrders: number;
  freshStationAnswer: FreshStationAnswer | null;
  needsStationTicket: boolean;
  itemsLabel: string;
};

function orderWaitMinutes(order: OrderFact, nowMs: number): number {
  const since = Date.parse(order.createdAt);
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, Math.floor((nowMs - since) / 60_000));
}

function stationForOrder(order: OrderFact): StationQuestionStation | null {
  const hasKitchen = order.items.some((item) =>
    isKitchenMenuSection(item.menuSection ?? null)
  );
  const hasDrinks = order.items.some((item) =>
    isBarMenuSection(item.menuSection ?? null)
  );
  if (hasKitchen) return "kitchen";
  if (hasDrinks) return "bar";
  return null;
}

function stationState(
  order: OrderFact,
  station: StationQuestionStation
): OrderStationFact | null {
  return order.stationStates?.find((row) => row.station === station) ?? null;
}

function itemsLabel(order: OrderFact): string {
  return order.items
    .map((item) =>
      item.quantity > 1
        ? `${item.quantity}× ${item.productName}`
        : item.productName
    )
    .join(", ");
}

function barLoadFromOps(venueOps?: VenueOpsBeliefs | null): {
  activeCount: number;
  avgWaitMinutes: number | null;
  stress: string | null;
} {
  const row = venueOps?.stationStress?.find((entry) => entry.station === "bar");
  return {
    activeCount: row?.activeCount ?? 0,
    avgWaitMinutes: row?.avgWaitMinutes ?? null,
    stress: row?.stress ?? null,
  };
}

function kitchenLoadFromOps(venueOps?: VenueOpsBeliefs | null): number {
  const row = venueOps?.stationStress?.find(
    (entry) => entry.station === "kitchen"
  );
  return row?.activeCount ?? 0;
}

function isBarRush(load: {
  activeCount: number;
  stress: string | null;
}): boolean {
  if (load.stress === "busy" || load.stress === "overloaded") return true;
  return load.activeCount >= 4;
}

/** Phase 1 — Denis checks order + station load before opening a bar/kitchen ticket. */
export function resolveGuestStatusIntel(input: {
  orders: OrderFact[];
  venueOps?: VenueOpsBeliefs | null;
  config: ConciergeConfig;
  freshStationAnswer?: FreshStationAnswer | null;
  nowMs?: number;
}): GuestStatusIntel {
  const nowMs = input.nowMs ?? Date.now();
  const drinkSla = input.config.ops.stationQuestions.drinkSlaMinutes ?? 4;
  const foodSla = input.config.ops.stationQuestions.foodSlaMinutes ?? 12;

  const waiting = input.orders.filter((order) =>
    WAITING_STATUSES.includes(order.status)
  );
  const primaryOrder =
    waiting.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    )[0] ?? null;

  if (!primaryOrder) {
    return {
      scenario: "no_open_order",
      primaryOrder: null,
      waitMinutes: 0,
      targetStation: null,
      barActiveOrders: barLoadFromOps(input.venueOps).activeCount,
      barStress: barLoadFromOps(input.venueOps).stress,
      barAvgWaitMinutes: barLoadFromOps(input.venueOps).avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: false,
      itemsLabel: "",
    };
  }

  const waitMinutes = orderWaitMinutes(primaryOrder, nowMs);
  const targetStation = stationForOrder(primaryOrder);
  const barLoad = barLoadFromOps(input.venueOps);
  const lifecycle = deriveCommerceLifecycleFacts(
    input.orders,
    input.venueOps ?? {
      operatingMode: "normal",
      kdsStress: "normal",
      acceptingOrders: true,
      unavailableProductIds: [],
      staffHint: null,
    },
    nowMs
  );

  const label = itemsLabel(primaryOrder);
  const fresh = input.freshStationAnswer ?? null;

  if (fresh) {
    return {
      scenario: "bar_answered",
      primaryOrder,
      waitMinutes,
      targetStation: fresh.station,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: fresh,
      needsStationTicket: false,
      itemsLabel: label,
    };
  }

  const station = targetStation ? stationState(primaryOrder, targetStation) : null;
  const stationStatus = station?.status ?? null;

  if (
    stationStatus === "ready" ||
    stationStatus === "picked_up" ||
    stationStatus === "served"
  ) {
    return {
      scenario: "ready_at_station",
      primaryOrder,
      waitMinutes,
      targetStation,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: false,
      itemsLabel: label,
    };
  }

  if (stationStatus === "in_prep" || primaryOrder.status === "preparing") {
    return {
      scenario: "in_progress",
      primaryOrder,
      waitMinutes,
      targetStation,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: false,
      itemsLabel: label,
    };
  }

  if (waitMinutes < 2) {
    return {
      scenario: "just_placed",
      primaryOrder,
      waitMinutes,
      targetStation,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: false,
      itemsLabel: label,
    };
  }

  const sla =
    targetStation === "kitchen" ? foodSla : drinkSla;
  const stuckAccepted =
    (primaryOrder.status === "pending" ||
      primaryOrder.status === "pending_approval" ||
      primaryOrder.status === "accepted") &&
    (!stationStatus || stationStatus === "queued");

  const overdue = waitMinutes >= sla;
  const rush = targetStation === "bar" && isBarRush(barLoad);

  if (stuckAccepted && (overdue || (rush && waitMinutes >= 3))) {
    return {
      scenario: "needs_station_check",
      primaryOrder,
      waitMinutes,
      targetStation,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: true,
      itemsLabel: label,
    };
  }

  if (rush || lifecycle.anyLate) {
    return {
      scenario: "queue_busy",
      primaryOrder,
      waitMinutes,
      targetStation,
      barActiveOrders: barLoad.activeCount,
      barStress: barLoad.stress,
      barAvgWaitMinutes: barLoad.avgWaitMinutes,
      kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
      freshStationAnswer: null,
      needsStationTicket: false,
      itemsLabel: label,
    };
  }

  return {
    scenario: stuckAccepted ? "needs_station_check" : "queue_busy",
    primaryOrder,
    waitMinutes,
    targetStation,
    barActiveOrders: barLoad.activeCount,
    barStress: barLoad.stress,
    barAvgWaitMinutes: barLoad.avgWaitMinutes,
    kitchenActiveOrders: kitchenLoadFromOps(input.venueOps),
    freshStationAnswer: null,
    needsStationTicket: stuckAccepted && waitMinutes >= 2,
    itemsLabel: label,
  };
}
