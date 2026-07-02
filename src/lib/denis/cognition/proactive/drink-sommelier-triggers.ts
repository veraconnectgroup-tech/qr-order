import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { GuestMealStage } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  barServedAt,
  drinkConsumptionMinutes,
} from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { ConciergeTableTempo } from "@/lib/denis/config/concierge-config.schema";
import type { OrderFact } from "@/lib/denis/loop/types";
import { resolveSituationalDrinkOffer } from "@/lib/denis/cognition/offer/situational-drink-offer";
import {
  avgDrinkDurationMinutes,
  formatSommelierPairingMessage,
  formatSommelierRefillMessage,
  suggestDrinksForFood,
  type SommelierPairingSuggestion,
} from "@/lib/denis/intelligence/drink-sommelier";
import { detectPartyDrinkGap } from "@/lib/denis/venue/party/group-drink-dynamics";
import { hasActiveDrinkOrder, isBarDrinkOrder } from "@/lib/denis/cognition/proactive/triggers";
import type { SessionPhase } from "@/lib/scene/types";

export type DrinkSommelierTriggerKind =
  | "sommelier_pairing"
  | "sommelier_refill"
  | "party_drink_gap";

export type DrinkSommelierTriggerMatch = {
  kind: DrinkSommelierTriggerKind;
  orderId?: string;
  drinkName?: string;
  foodName?: string;
  suggestion?: SommelierPairingSuggestion;
  partySize?: number;
  devicesWithDrink?: number;
  message: string;
  prompt: string;
};

const MS_MINUTE = 60_000;
const REFILL_DELIVERED_BUFFER_MINUTES = 3;

function minutesAgo(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / MS_MINUTE;
}

function foodItemsFromOrder(order: AiGuestOrder) {
  return order.order_items.filter((item) => item.menu_section === "food");
}

function drinkItemsFromOrder(order: AiGuestOrder) {
  return order.order_items.filter((item) => item.menu_section === "drinks");
}

function hasMainCourseDelivered(orders: AiGuestOrder[]): boolean {
  return orders.some(
    (order) =>
      order.status === "delivered" &&
      order.order_items.some((item) => item.menu_section === "food")
  );
}

function hasOpenFoodOrder(orders: AiGuestOrder[]): boolean {
  return orders.some(
    (order) =>
      ["pending", "accepted", "preparing"].includes(order.status) &&
      foodItemsFromOrder(order).length > 0
  );
}

function mealStageFromSession(input: {
  sessionPhase?: SessionPhase | null;
  orders: AiGuestOrder[];
}): GuestMealStage {
  const hasFoodDelivered = hasMainCourseDelivered(input.orders);
  const hasFood = hasOpenFoodOrder(input.orders) || hasFoodDelivered;
  const drinkOnly =
    input.orders.length > 0 &&
    input.orders.every((order) => isBarDrinkOrder(order));

  if (input.sessionPhase === "settling" || input.sessionPhase === "closed") {
    return "post_meal";
  }
  if (!hasFood && drinkOnly) return "aperitif";
  if (!hasFood) return "pre_order";
  if (hasFoodDelivered && !hasOpenFoodOrder(input.orders)) return "between_courses";
  return "main";
}

/** Food order without drink — sommelier pairing (steak → Cabernet / Pilsner). */
export function detectSommelierFoodPairingTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now(),
  options?: {
    hasDrinkInCart?: boolean;
    sessionPhase?: SessionPhase | null;
    vkgDrinkName?: string | null;
  }
): DrinkSommelierTriggerMatch | null {
  if (options?.hasDrinkInCart) return null;
  if (hasActiveDrinkOrder(orders)) return null;

  const mealStage = mealStageFromSession({
    sessionPhase: options?.sessionPhase,
    orders,
  });

  const recentFood = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (!["pending", "accepted", "preparing"].includes(order.status)) return false;
      if (!foodItemsFromOrder(order).length) return false;
      return minutesAgo(order.created_at, now) <= 3;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (!recentFood) return null;

  const foodItem = foodItemsFromOrder(recentFood)[0];
  const foodName = foodItem?.product_name ?? "jelo";
  const foodTags =
    (foodItem as { food_tags?: string[] | null }).food_tags?.filter(Boolean) ??
    [];

  const suggestion =
    resolveSituationalDrinkOffer({
      mealStage,
      hasFoodDelivered: hasMainCourseDelivered(orders),
      hasOpenFoodOrder: true,
      foodName,
      vkgDrinkName: options?.vkgDrinkName,
    }) ?? suggestDrinksForFood(foodName, "pairing", foodTags);

  if (!suggestion) return null;
  if (suggestion.occasion === "digestif") return null;

  const message = formatSommelierPairingMessage({ suggestion, language: "sr" });

  return {
    kind: "sommelier_pairing",
    orderId: recentFood.id,
    foodName,
    suggestion,
    message,
    prompt: `Sommelier pairing for ${foodName}: ${suggestion.primary}${suggestion.secondary ? ` / ${suggestion.secondary}` : ""}.`,
  };
}

/** ADR-043 S8 — station `served_at` + consumption heuristic (precise empty-glass estimate). */
export function detectSommelierStationTempoRefill(
  orderFacts: OrderFact[],
  input: {
    tempoConfig: ConciergeTableTempo;
    hasDrinkInCart?: boolean;
    language?: string | null;
    now?: number;
    isShown: (orderId: string) => boolean;
  }
): DrinkSommelierTriggerMatch | null {
  if (input.hasDrinkInCart) return null;

  const now = input.now ?? Date.now();

  const candidate = orderFacts
    .filter((order) => {
      if (input.isShown(order.id)) return false;
      if (order.status === "cancelled" || order.status === "rejected") return false;
      const drinkItem = order.items.find((item) => item.menuSection === "drinks");
      if (!drinkItem) return false;

      const servedAt = barServedAt(order);
      if (!servedAt) return false;

      const targetMinutes = drinkConsumptionMinutes(
        drinkItem.productName,
        input.tempoConfig,
        {
          drinkFamily: drinkItem.drinkFamily ?? null,
          menuSection: drinkItem.menuSection ?? "drinks",
        }
      );
      const elapsed = minutesAgo(servedAt, now);
      return (
        elapsed >= targetMinutes + input.tempoConfig.drinksFinishedGraceMinutes
      );
    })
    .sort((a, b) => {
      const aServed = barServedAt(a) ?? a.createdAt;
      const bServed = barServedAt(b) ?? b.createdAt;
      return Date.parse(bServed) - Date.parse(aServed);
    })[0];

  if (!candidate) return null;

  const drinkName =
    candidate.items.find((item) => item.menuSection === "drinks")?.productName ??
    "piće";
  const message = formatSommelierRefillMessage({
    drinkName,
    language: input.language,
  });

  return {
    kind: "sommelier_refill",
    orderId: candidate.id,
    drinkName,
    message,
    prompt: `${drinkName} served at bar — empty glass estimate reached, offer second round once.`,
  };
}

/** Type-aware refill — beer ~20min, wine ~30min, cocktail ~25min. */
export function detectSommelierRefillTrigger(
  orders: AiGuestOrder[],
  input: {
    isShown: (orderId: string) => boolean;
    hasDrinkInCart?: boolean;
    language?: string | null;
    now?: number;
  }
): DrinkSommelierTriggerMatch | null {
  if (input.hasDrinkInCart) return null;
  if (hasActiveDrinkOrder(orders)) return null;

  const now = input.now ?? Date.now();

  const candidate = orders
    .filter((order) => {
      if (input.isShown(order.id)) return false;
      if (order.status !== "delivered") return false;
      if (!isBarDrinkOrder(order)) return false;

      const drinkName = drinkItemsFromOrder(order)[0]?.product_name ?? "piće";
      const targetMinutes = avgDrinkDurationMinutes(drinkName);
      const orderAge = minutesAgo(order.created_at, now);
      if (orderAge < targetMinutes - 2 || orderAge > targetMinutes + 12) {
        return false;
      }

      const deliveredRef = order.delivered_at ?? order.created_at;
      const sinceDelivered = minutesAgo(deliveredRef, now);
      const minDelivered = Math.max(
        10,
        targetMinutes - REFILL_DELIVERED_BUFFER_MINUTES - 5
      );
      return sinceDelivered >= minDelivered;
    })
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    )[0];

  if (!candidate) return null;

  const drinkName = drinkItemsFromOrder(candidate)[0]?.product_name ?? "piće";
  const message = formatSommelierRefillMessage({
    drinkName,
    language: input.language,
  });

  return {
    kind: "sommelier_refill",
    orderId: candidate.id,
    drinkName,
    message,
    prompt: `${drinkName} ordered ~${Math.round(avgDrinkDurationMinutes(drinkName))} min ago — likely empty, offer refill once.`,
  };
}

/** 3/4 party members have drinks — invite the missing guest once. */
export function detectPartyDrinkGapTrigger(input: {
  orders: AiGuestOrder[];
  partySize: number;
  hasDrinkInCart?: boolean;
  isShown: () => boolean;
}): DrinkSommelierTriggerMatch | null {
  const gap = detectPartyDrinkGap({
    partySize: input.partySize,
    orders: input.orders,
    hasDrinkInCart: input.hasDrinkInCart,
    isShown: input.isShown,
  });
  if (!gap) return null;

  return {
    kind: "party_drink_gap",
    partySize: gap.partySize,
    devicesWithDrink: gap.devicesWithDrink,
    message: "I za vas nešto za piti?",
    prompt: `Party ${gap.partySize}: ${gap.devicesWithDrink} have drinks — ask missing guest once.`,
  };
}
