import type { ConciergeTableTempo } from "@/lib/denis/config/concierge-config.schema";
import { classifyDrinkKnowledge } from "@/lib/denis/kernel/vkg/drink-knowledge-graph";
import { hasActiveDrinkOrder } from "@/lib/denis/cognition/proactive/triggers";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

export type TableTempoPhase =
  | "browsing_stalled"
  | "drinks_finished_estimate"
  | "post_meal_idle"
  | "none";

export type TableTempoSessionFacts = {
  sessionOpenedAt: string;
  orders: OrderFact[];
  guestMessageCount: number;
  idleMinutes: number;
  nowMs?: number;
  config: ConciergeTableTempo;
};

const CLOSED_ORDER_STATUSES = ["cancelled", "rejected"] as const;

function minutesSince(iso: string, nowMs: number): number {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, (nowMs - ts) / 60_000);
}

function activeOrders(orders: OrderFact[]): OrderFact[] {
  return orders.filter(
    (order) =>
      !CLOSED_ORDER_STATUSES.includes(
        order.status as (typeof CLOSED_ORDER_STATUSES)[number]
      )
  );
}

function orderHasKitchenItems(order: OrderFact): boolean {
  return order.items.some((item) => isKitchenMenuSection(item.menuSection));
}

function orderHasDrinkItems(order: OrderFact): boolean {
  return order.items.some((item) => item.menuSection === "drinks");
}

/**
 * Heuristic (ADR-043 S8): empty glass is estimated from bar `served_at` plus
 * typical consumption minutes by drink type — not measured by sensor.
 */
export function drinkConsumptionMinutes(
  drinkName: string,
  config: ConciergeTableTempo,
  metadata?: { drinkFamily?: string | null; menuSection?: string | null }
): number {
  const node = classifyDrinkKnowledge({
    productName: drinkName,
    drinkFamily: metadata?.drinkFamily ?? null,
    menuSection: metadata?.menuSection ?? "drinks",
  });

  switch (node.category) {
    case "beer":
      return config.drinkBeerMinutes;
    case "wine":
      return config.drinkWineMinutes;
    case "coffee":
      return config.drinkCoffeeMinutes;
    default:
      return config.drinkDefaultMinutes;
  }
}

export function barServedAt(order: OrderFact): string | null {
  const bar = order.stationStates?.find((row) => row.station === "bar");
  if (!bar) return null;
  if (bar.servedAt) return bar.servedAt;
  if (bar.status === "served" || bar.status === "picked_up") {
    return bar.pickedUpAt ?? bar.readyAt ?? null;
  }
  return null;
}

export function kitchenServedAt(order: OrderFact): string | null {
  if (!orderHasKitchenItems(order)) return null;
  const kitchen = order.stationStates?.find((row) => row.station === "kitchen");
  if (!kitchen) {
    if (order.status === "delivered") {
      return order.deliveredAt ?? null;
    }
    return null;
  }
  if (kitchen.servedAt) return kitchen.servedAt;
  if (kitchen.status === "served" || kitchen.status === "picked_up") {
    return kitchen.pickedUpAt ?? kitchen.readyAt ?? null;
  }
  return null;
}

function allKitchenFoodServed(orders: OrderFact[]): boolean {
  const foodOrders = activeOrders(orders).filter(orderHasKitchenItems);
  if (foodOrders.length === 0) return false;

  return foodOrders.every((order) => {
    const kitchen = order.stationStates?.find((row) => row.station === "kitchen");
    if (kitchen) {
      return ["served", "picked_up"].includes(kitchen.status);
    }
    return order.status === "delivered";
  });
}

function latestKitchenServedAt(orders: OrderFact[], nowMs: number): number | null {
  let latest: number | null = null;
  for (const order of activeOrders(orders)) {
    const servedAt = kitchenServedAt(order);
    if (!servedAt) continue;
    const ts = Date.parse(servedAt);
    if (!Number.isFinite(ts)) continue;
    latest = latest == null ? ts : Math.max(latest, ts);
  }
  return latest;
}

export function detectDrinksFinishedEstimate(input: {
  orders: OrderFact[];
  config: ConciergeTableTempo;
  nowMs: number;
  aiGuestOrders?: AiGuestOrder[];
}): boolean {
  if (input.aiGuestOrders && hasActiveDrinkOrder(input.aiGuestOrders)) {
    return false;
  }

  for (const order of activeOrders(input.orders)) {
    if (!orderHasDrinkItems(order)) continue;

    const servedAt = barServedAt(order);
    if (!servedAt) continue;

    const drinkItem = order.items.find((item) => item.menuSection === "drinks");
    const consumption = drinkConsumptionMinutes(
      drinkItem?.productName ?? "piće",
      input.config,
      {
        drinkFamily: drinkItem?.drinkFamily ?? null,
        menuSection: drinkItem?.menuSection ?? "drinks",
      }
    );
    const elapsed = minutesSince(servedAt, input.nowMs);
    if (elapsed >= consumption + input.config.drinksFinishedGraceMinutes) {
      return true;
    }
  }

  return false;
}

export function detectTableTempoPhase(
  input: TableTempoSessionFacts
): TableTempoPhase {
  if (!input.config.enabled) return "none";

  const nowMs = input.nowMs ?? Date.now();
  const openOrders = activeOrders(input.orders);
  const sessionAgeMinutes = minutesSince(input.sessionOpenedAt, nowMs);

  if (openOrders.length === 0) {
    if (sessionAgeMinutes >= input.config.browsingStalledMinutes) {
      return "browsing_stalled";
    }
    return "none";
  }

  if (
    allKitchenFoodServed(openOrders) &&
    input.idleMinutes >= input.config.postMealIdleMinutes
  ) {
    const latestServed = latestKitchenServedAt(openOrders, nowMs);
    if (latestServed != null) {
      const idleSinceFood = (nowMs - latestServed) / 60_000;
      if (idleSinceFood >= input.config.postMealIdleMinutes) {
        return "post_meal_idle";
      }
    }
  }

  if (
    detectDrinksFinishedEstimate({
      orders: openOrders,
      config: input.config,
      nowMs,
    })
  ) {
    return "drinks_finished_estimate";
  }

  return "none";
}

export function tableTempoDedupeKey(phase: Exclude<TableTempoPhase, "none">): string {
  return `table_tempo:${phase}`;
}

export function shouldEmitTableTempoGuestNudge(input: {
  phase: Exclude<TableTempoPhase, "none" | "post_meal_idle">;
  emittedKeys: string[];
  dismissedKeys: string[];
}): boolean {
  const key = tableTempoDedupeKey(input.phase);
  if (input.emittedKeys.includes(key) || input.dismissedKeys.includes(key)) {
    return false;
  }
  return true;
}

/**
 * Guest ignored drinks tempo nudge — escalate to waiter, do not re-nudge guest.
 */
export function shouldEscalateDrinksFinishedToWaiter(input: {
  emittedKeys: string[];
  dismissedKeys: string[];
  guestIgnoredMinutes: number;
  drinksNudgeEmittedAtMs: number | null;
  nowMs: number;
  hasActiveDrinkOrder: boolean;
}): boolean {
  if (input.hasActiveDrinkOrder) return false;

  const guestKey = tableTempoDedupeKey("drinks_finished_estimate");
  const guestNudged =
    input.emittedKeys.includes(guestKey) ||
    input.emittedKeys.some(
      (key) =>
        key.startsWith("sommelier_refill:") ||
        key === "sommelier_refill" ||
        key.startsWith("drink_refill:")
    );
  const dismissed =
    input.dismissedKeys.includes(guestKey) ||
    input.dismissedKeys.some(
      (key) => key.includes("sommelier_refill") || key.includes("drink_refill")
    );

  if (dismissed) return true;
  if (!guestNudged) return false;

  if (input.drinksNudgeEmittedAtMs == null) return false;
  const minutesSinceNudge =
    (input.nowMs - input.drinksNudgeEmittedAtMs) / 60_000;
  return minutesSinceNudge >= input.guestIgnoredMinutes;
}

export function findDrinksTempoNudgeEmittedAt(
  events: import("@/lib/denis/platform/timeline-types").DenisTimelineRow[]
): number | null {
  let latest: number | null = null;

  for (const event of events) {
    if (event.event_type !== "proactive.emitted") continue;
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};
    const kind = payload.kind;
    const dedupeKey = payload.dedupeKey;
    const isDrinksTempo =
      kind === "sommelier_refill" ||
      kind === "drink_refill" ||
      (typeof dedupeKey === "string" &&
        dedupeKey.includes("drinks_finished"));
    if (!isDrinksTempo) continue;

    const ts = Date.parse(event.created_at);
    if (!Number.isFinite(ts)) continue;
    latest = latest == null ? ts : Math.max(latest, ts);
  }

  return latest;
}

export function buildTableTempoBrowseMessage(language: string | null): string {
  if (language?.startsWith("de")) {
    return "Kann ich bei der Auswahl helfen?";
  }
  if (language?.startsWith("en")) {
    return "Can I help you choose from the menu?";
  }
  return "Mogu li da pomognem oko izbora?";
}
