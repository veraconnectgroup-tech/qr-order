import type { ConciergeDessertWindow } from "@/lib/denis/config/concierge-config.schema";
import { kitchenServedAt } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import { orderFactToTriggerOrder } from "@/lib/denis/stations/order-fact-station";
import { evaluateStationQuestionTriggers } from "@/lib/denis/stations/question-triggers";
import type { ConciergeStationQuestions } from "@/lib/denis/config/concierge-config.schema";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import type { OrderFact } from "@/lib/denis/loop/types";

export type DessertWindowPhase =
  | "before_window"
  | "in_window"
  | "after_window"
  | "none";

export type DessertWindowDetection = {
  phase: DessertWindowPhase;
  orderId: string | null;
  kitchenServedAt: string | null;
  minutesSinceServed: number | null;
};

export type PostMealChainStep = "dessert" | "coffee" | "digestif" | "none";

export const DESSERT_WINDOW_DEDUPE_KEY = "dessert_window";
export const COFFEE_AFTER_DESSERT_DEDUPE_KEY = "coffee_nudge";
export const DIGESTIF_AFTER_COFFEE_DEDUPE_KEY = "digestif_nudge";

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

function orderHasKitchenFood(order: OrderFact): boolean {
  return order.items.some((item) => isKitchenMenuSection(item.menuSection));
}

export function hasDessertInOrderFacts(orders: OrderFact[]): boolean {
  return orders.some((order) =>
    order.items.some((item) => item.menuSection === "desserts")
  );
}

export function hasCoffeeInOrderFacts(orders: OrderFact[]): boolean {
  return orders.some((order) =>
    order.items.some((item) => {
      if (item.menuSection !== "drinks") return false;
      const name = item.productName.toLowerCase();
      return (
        name.includes("kafa") ||
        name.includes("coffee") ||
        name.includes("espresso") ||
        name.includes("cappuccino") ||
        item.drinkFamily?.toLowerCase() === "coffee"
      );
    })
  );
}

function latestKitchenFoodServedOrder(
  orders: OrderFact[]
): { order: OrderFact; servedAt: string } | null {
  let best: { order: OrderFact; servedAt: string; ts: number } | null = null;

  for (const order of activeOrders(orders)) {
    if (!orderHasKitchenFood(order)) continue;
    const servedAt = kitchenServedAt(order);
    if (!servedAt) continue;
    const ts = Date.parse(servedAt);
    if (!Number.isFinite(ts)) continue;
    if (!best || ts > best.ts) {
      best = { order, servedAt, ts };
    }
  }

  return best ? { order: best.order, servedAt: best.servedAt } : null;
}

/**
 * Heuristic (ADR-043 S10): dessert window opens after kitchen `served_at` plus
 * typical main-course consumption minutes — not clock time or global delivered.
 */
export function detectDessertWindow(input: {
  orders: OrderFact[];
  config: ConciergeDessertWindow;
  nowMs?: number;
}): DessertWindowDetection {
  if (!input.config.enabled) {
    return {
      phase: "none",
      orderId: null,
      kitchenServedAt: null,
      minutesSinceServed: null,
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const openOrders = activeOrders(input.orders);

  if (openOrders.length === 0 || !openOrders.some(orderHasKitchenFood)) {
    return {
      phase: "none",
      orderId: null,
      kitchenServedAt: null,
      minutesSinceServed: null,
    };
  }

  if (hasDessertInOrderFacts(openOrders)) {
    return {
      phase: "after_window",
      orderId: null,
      kitchenServedAt: null,
      minutesSinceServed: null,
    };
  }

  const latest = latestKitchenFoodServedOrder(openOrders);
  if (!latest) {
    return {
      phase: "none",
      orderId: null,
      kitchenServedAt: null,
      minutesSinceServed: null,
    };
  }

  const elapsed = minutesSince(latest.servedAt, nowMs);
  const openAt =
    input.config.mainCourseConsumptionMinutes + input.config.graceMinutes;
  const closeAt = openAt + input.config.windowMaxMinutes;

  if (elapsed < openAt) {
    return {
      phase: "before_window",
      orderId: latest.order.id,
      kitchenServedAt: latest.servedAt,
      minutesSinceServed: elapsed,
    };
  }

  if (elapsed <= closeAt) {
    return {
      phase: "in_window",
      orderId: latest.order.id,
      kitchenServedAt: latest.servedAt,
      minutesSinceServed: elapsed,
    };
  }

  return {
    phase: "after_window",
    orderId: latest.order.id,
    kitchenServedAt: latest.servedAt,
    minutesSinceServed: elapsed,
  };
}

/** Truth before upsell — open station question or SLA breach blocks revenue nudges. */
export function hasStationProblemsBlockingUpsell(input: {
  orders: OrderFact[];
  stationQuestions: ConciergeStationQuestions;
  nowMs?: number;
}): boolean {
  if (!input.stationQuestions.enabled) return false;
  const triggers = evaluateStationQuestionTriggers({
    orders: input.orders.map(orderFactToTriggerOrder),
    config: input.stationQuestions,
    now: input.nowMs,
  });
  return triggers.length > 0;
}

function isDismissed(keys: string[], key: string): boolean {
  return keys.includes(key);
}

/** Guest declined/dismissed dessert — stop dessert→coffee→digestif chain. */
export function isDessertUpsellChainBlocked(dismissedKeys: string[]): boolean {
  return (
    isDismissed(dismissedKeys, "dessert_nudge") ||
    isDismissed(dismissedKeys, DESSERT_WINDOW_DEDUPE_KEY) ||
    dismissedKeys.some((key) => key.startsWith("dessert_nudge:"))
  );
}

export function isCoffeeUpsellChainBlocked(dismissedKeys: string[]): boolean {
  return (
    isDessertUpsellChainBlocked(dismissedKeys) ||
    isDismissed(dismissedKeys, COFFEE_AFTER_DESSERT_DEDUPE_KEY) ||
    dismissedKeys.some((key) => key.startsWith("coffee_nudge:"))
  );
}

export function shouldSkipDessertForAcceptRate(input: {
  acceptRate: number | null;
  impressions: number;
  config: ConciergeDessertWindow;
}): boolean {
  if (input.acceptRate == null) return false;
  if (input.impressions < input.config.minImpressionsForLearning) return false;
  return input.acceptRate < input.config.minAcceptRate;
}

export function detectPostMealChainStep(input: {
  orders: OrderFact[];
  config: ConciergeDessertWindow;
  dismissedKeys: string[];
  nowMs?: number;
}): PostMealChainStep {
  if (!input.config.enabled) return "none";

  const openOrders = activeOrders(input.orders);
  const hasDessert = hasDessertInOrderFacts(openOrders);
  const hasCoffee = hasCoffeeInOrderFacts(openOrders);

  if (!hasDessert) {
    const window = detectDessertWindow({
      orders: openOrders,
      config: input.config,
      nowMs: input.nowMs,
    });
    if (window.phase === "in_window" && !isDessertUpsellChainBlocked(input.dismissedKeys)) {
      return "dessert";
    }
    return "none";
  }

  if (
    input.config.includeCoffee &&
    !hasCoffee &&
    !isCoffeeUpsellChainBlocked(input.dismissedKeys)
  ) {
    return "coffee";
  }

  if (
    input.config.includeDigestif &&
    hasCoffee &&
    !isCoffeeUpsellChainBlocked(input.dismissedKeys) &&
    !isDismissed(input.dismissedKeys, DIGESTIF_AFTER_COFFEE_DEDUPE_KEY) &&
    !input.dismissedKeys.some((key) => key.startsWith("digestif_nudge:"))
  ) {
    return "digestif";
  }

  return "none";
}

export function buildCoffeeAfterDessertMessage(language: string | null): string {
  if (language?.startsWith("de")) {
    return "Möchten Sie einen Kaffee zum Dessert?";
  }
  if (language?.startsWith("en")) {
    return "Would you like a coffee to go with dessert?";
  }
  return "Da li želite kafu uz desert?";
}

export function buildDigestifAfterCoffeeMessage(language: string | null): string {
  if (language?.startsWith("de")) {
    return "Darf ich einen Digestif empfehlen?";
  }
  if (language?.startsWith("en")) {
    return "May I suggest a digestif after coffee?";
  }
  return "Mogu da preporučim digestiv posle kafe?";
}
