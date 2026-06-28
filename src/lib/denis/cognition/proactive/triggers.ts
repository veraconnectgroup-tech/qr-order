import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { GuestFrustrationLevel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  buildReviewContentSuggestion,
  buildSentimentGatedReviewContent,
  resolveRecoveryReviewState,
} from "@/lib/denis/commerce/experience/review-orchestration";
import {
  resolveReviewEligibility,
  reviewDelayOpen,
} from "@/lib/denis/commerce/review-funnel";
import {
  detectOptimalReviewMoment,
  isReviewMomentReady,
  type ReviewTriggerMoment,
} from "@/lib/denis/cognition/proactive/detect-review-moment";
import {
  buildLowExperienceStaffAlertMessage,
  shouldEmitLowExperienceStaffAlert,
} from "@/lib/commerce/experience/resolve-experience-moment";
import type { SessionPhase } from "@/lib/scene/types";

export type ProactiveTriggerKind =
  | "pairing"
  | "dessert"
  | "welcome_back"
  | "slow_kitchen"
  | "order_ready"
  | "kitchen_busy"
  | "kitchen_busy_preorder"
  | "order_eta_update"
  | "order_ready_notify"
  | "drink_refill"
  | "drink_with_food"
  | "round_two"
  | "happy_hour_upsell"
  | "google_review"
  | "internal_feedback";

export type VenueScheduleSnapshot = {
  happyHour?: boolean;
  /** Local time label e.g. "19:00" — situation pack BAR block. */
  happyHourUntil?: string | null;
  barOpen?: boolean;
};

export type VkgDrinkPairingHint = {
  foodName: string;
  drinkName: string;
  serveSize?: string | null;
};

export type KitchenBacklogLevel = "normal" | "busy" | "critical";

export type ProactiveTriggerMatch = {
  kind: ProactiveTriggerKind;
  orderId?: string;
  visitTimestamp?: string;
  waitMinutes?: number;
  remainingEtaMinutes?: number | null;
  estimatedPrepMinutes?: number | null;
  prepEstimateConfidence?: "none" | "low" | "medium" | "high" | null;
  delaySeverity?: "medium" | "high";
  orderItemsLabel?: string;
  kitchenBacklogPendingCount?: number;
  backlogLevel?: KitchenBacklogLevel;
  drinkName?: string;
  suggestedDrinkName?: string;
  foodName?: string;
  serveSize?: string | null;
  suggestedRoundDrink?: string;
  partySize?: number;
  happyHourActive?: boolean;
  prompt: string;
  triggerMoment?: ReviewTriggerMoment;
  reviewRoute?: "google" | "internal";
  contentSuggestion?: string;
};

export type KitchenTableWait = {
  tableId: string;
  tableName: string;
  waitMinutes: number;
};

const MS_MINUTE = 60_000;
export const DEFAULT_LATE_FALLBACK_MINUTES = 15;
/** Backlog strictly greater than 5 pending → busy preorder warning. */
export const KITCHEN_BUSY_PREORDER_THRESHOLD = 6;
export const KITCHEN_BUSY_PENDING_THRESHOLD = 8;
export const ORDER_ETA_UPDATE_MULTIPLIER = 1.5;
export const KITCHEN_STAFF_ESCALATION_MINUTES = 20;
/** More than 2 delayed tables → staff alert. */
export const KITCHEN_STAFF_ESCALATION_MIN_TABLES = 3;

const KITCHEN_WAIT_STATUSES = ["pending", "accepted", "preparing"] as const;

function minutesAgo(iso: string, now = Date.now()) {
  return (now - new Date(iso).getTime()) / MS_MINUTE;
}

function formatOrderItems(order: AiGuestOrder) {
  return order.order_items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
      return `${qty}${item.product_name}`;
    })
    .join(", ");
}

function formatPastItems(orders: AiGuestOrder[]) {
  const names = orders.flatMap((order) =>
    order.order_items.map((item) => item.product_name)
  );
  return [...new Set(names)].join(", ");
}

function hasDessertInOrders(orders: AiGuestOrder[]) {
  return orders.some((order) =>
    order.order_items.some((item) => item.menu_section === "desserts")
  );
}

export function isKitchenFoodOrder(order: AiGuestOrder): boolean {
  return order.order_items.some(
    (item) => item.menu_section === "food" || item.menu_section === "desserts"
  );
}

function isKitchenWaitStatus(status: string): boolean {
  return (KITCHEN_WAIT_STATUSES as readonly string[]).includes(status);
}

export function hasActiveDrinkOrder(orders: AiGuestOrder[]): boolean {
  return orders.some(
    (order) =>
      ["pending", "accepted", "preparing", "ready"].includes(order.status) &&
      order.order_items.some((item) => item.menu_section === "drinks")
  );
}

export function delayThresholdMinutes(
  order: Pick<
    AiGuestOrder,
    "estimated_prep_minutes" | "prep_estimate_confidence"
  > & Record<string, unknown>,
  fallbackMinutes = DEFAULT_LATE_FALLBACK_MINUTES
): number {
  const estimate = order.estimated_prep_minutes;
  if (estimate == null || estimate <= 0) return fallbackMinutes;
  const multiplier =
    order.prep_estimate_confidence === "high"
      ? 1.3
      : order.prep_estimate_confidence === "medium"
        ? 1.5
        : 1.5;
  return Math.max(fallbackMinutes, Math.ceil(estimate * multiplier));
}

/** Minutes until likely ready — shrinks as wait grows past ETA. */
export function estimateRemainingPrepMinutes(
  order: Pick<AiGuestOrder, "created_at" | "estimated_prep_minutes">,
  now = Date.now()
): number {
  const wait = minutesAgo(order.created_at, now);
  const estimate = order.estimated_prep_minutes ?? DEFAULT_LATE_FALLBACK_MINUTES;
  const remaining = Math.ceil(estimate - wait);
  if (remaining > 0) return remaining;
  const overdue = wait - estimate;
  return Math.max(1, Math.min(10, Math.ceil(5 - overdue * 0.25)));
}

export function isOrderPastPrepEstimate(
  order: Pick<AiGuestOrder, "created_at" | "estimated_prep_minutes">,
  now = Date.now(),
  fallbackMinutes = DEFAULT_LATE_FALLBACK_MINUTES
): boolean {
  const wait = minutesAgo(order.created_at, now);
  const estimate = order.estimated_prep_minutes ?? fallbackMinutes;
  return wait >= estimate;
}

export function maxKitchenWaitMinutesForTable(
  orders: AiGuestOrder[],
  now = Date.now()
): number {
  const waits = orders
    .filter(
      (order) => isKitchenFoodOrder(order) && isKitchenWaitStatus(order.status)
    )
    .map((order) => minutesAgo(order.created_at, now));
  return waits.length ? Math.max(...waits) : 0;
}

export function countVenueKitchenPending(
  pendingCount: number | null | undefined,
  stationKitchenActiveCount: number | null | undefined
): number {
  return Math.max(pendingCount ?? 0, stationKitchenActiveCount ?? 0);
}

/** Venue backlog level for situation pack + preorder posture. */
export function resolveKitchenBacklogLevel(
  pendingCount: number
): KitchenBacklogLevel {
  if (pendingCount > 10) return "critical";
  if (pendingCount > 5) return "busy";
  return "normal";
}

export function isOrderPastEtaMultiplier(
  order: Pick<AiGuestOrder, "created_at" | "estimated_prep_minutes">,
  now = Date.now(),
  multiplier = ORDER_ETA_UPDATE_MULTIPLIER,
  fallbackMinutes = DEFAULT_LATE_FALLBACK_MINUTES
): boolean {
  const wait = minutesAgo(order.created_at, now);
  const estimate = order.estimated_prep_minutes ?? fallbackMinutes;
  return wait >= estimate * multiplier;
}

export const DRINK_REFILL_ORDER_MIN_MINUTES = 20;
export const DRINK_REFILL_ORDER_MAX_MINUTES = 30;
export const DRINK_REFILL_DELIVERED_MIN_MINUTES = 15;
export const DRINK_WITH_FOOD_WINDOW_MINUTES = 3;

export function isBarDrinkOrder(order: AiGuestOrder): boolean {
  return order.order_items.some((item) => item.menu_section === "drinks");
}

function drinkItemsFromOrder(order: AiGuestOrder) {
  return order.order_items.filter((item) => item.menu_section === "drinks");
}

function foodItemsFromOrder(order: AiGuestOrder) {
  return order.order_items.filter((item) => item.menu_section === "food");
}

function hasOpenDrinkActivity(orders: AiGuestOrder[], hasDrinkInCart?: boolean): boolean {
  if (hasDrinkInCart) return true;
  return hasActiveDrinkOrder(orders);
}

function topDeliveredDrinkName(orders: AiGuestOrder[]): string | null {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "delivered") continue;
    for (const item of drinkItemsFromOrder(order)) {
      counts.set(item.product_name, (counts.get(item.product_name) ?? 0) + item.quantity);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function hasMainCourseInOrders(orders: AiGuestOrder[]) {
  return orders.some((order) =>
    order.order_items.some((item) => item.menu_section === "food")
  );
}

export function detectPairingTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now()
): ProactiveTriggerMatch | null {
  const recent = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      const ageMin = minutesAgo(order.created_at, now);
      if (ageMin > 2) return false;
      return order.status === "accepted" || order.status === "pending";
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const order = recent[0];
  if (!order?.order_items.length) return null;

  return {
    kind: "pairing",
    orderId: order.id,
    prompt: `Gast bestellt: ${formatOrderItems(order)}. Empfehle EIN Getraenk.`,
  };
}

/** VKG-aware drink suggestion when guest ordered food without a drink. */
export function detectDrinkWithFoodTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now(),
  options?: {
    vkgPairing?: VkgDrinkPairingHint | null;
    hasDrinkInCart?: boolean;
  }
): ProactiveTriggerMatch | null {
  if (hasOpenDrinkActivity(orders, options?.hasDrinkInCart)) return null;

  const recentFood = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (!["pending", "accepted", "preparing"].includes(order.status)) return false;
      if (!foodItemsFromOrder(order).length) return false;
      return minutesAgo(order.created_at, now) <= DRINK_WITH_FOOD_WINDOW_MINUTES;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const order = recentFood[0];
  if (!order) return null;

  const foodItem = foodItemsFromOrder(order)[0];
  const pairing = options?.vkgPairing;
  const drinkName = pairing?.drinkName?.trim();
  if (!drinkName) return null;

  const foodName = pairing?.foodName ?? foodItem?.product_name ?? "food";
  const serve = pairing?.serveSize?.trim();
  const drinkLabel = serve ? `${drinkName} ${serve}` : drinkName;
  return {
    kind: "drink_with_food",
    orderId: order.id,
    foodName,
    suggestedDrinkName: drinkName,
    serveSize: serve ?? null,
    prompt: `Guest ordered ${foodName} — suggest ${drinkLabel} as VKG pairing.`,
  };
}

/** Refill window: drink ordered 20–30 min ago, finished 15+ min ago, no new drink. */
export function detectDrinkRefillTrigger(
  orders: AiGuestOrder[],
  input: {
    isShown: (orderId: string) => boolean;
    hasDrinkInCart?: boolean;
    happyHourActive?: boolean;
    now?: number;
  }
): ProactiveTriggerMatch | null {
  if (hasOpenDrinkActivity(orders, input.hasDrinkInCart)) return null;

  const now = input.now ?? Date.now();
  const candidate = orders
    .filter((order) => {
      if (input.isShown(order.id)) return false;
      if (order.status !== "delivered") return false;
      if (!isBarDrinkOrder(order)) return false;
      const orderAge = minutesAgo(order.created_at, now);
      if (
        orderAge < DRINK_REFILL_ORDER_MIN_MINUTES ||
        orderAge > DRINK_REFILL_ORDER_MAX_MINUTES
      ) {
        return false;
      }
      const deliveredRef = order.delivered_at ?? order.created_at;
      return minutesAgo(deliveredRef, now) >= DRINK_REFILL_DELIVERED_MIN_MINUTES;
    })
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    )[0];

  if (!candidate) return null;

  const drinkName = drinkItemsFromOrder(candidate)[0]?.product_name;
  return {
    kind: "drink_refill",
    orderId: candidate.id,
    drinkName,
    happyHourActive: input.happyHourActive,
    prompt: drinkName
      ? `Guest finished ${drinkName} — offer another or something new.`
      : "Guest finished drink — offer refill.",
  };
}

/** Party table — everyone finished drinks, suggest another round. */
export function detectRoundTwoTrigger(input: {
  orders: AiGuestOrder[];
  partySize: number;
  hasDrinkInCart?: boolean;
  isShown: () => boolean;
  now?: number;
}): ProactiveTriggerMatch | null {
  if (input.isShown()) return null;
  if (input.partySize < 2) return null;
  if (hasOpenDrinkActivity(input.orders, input.hasDrinkInCart)) return null;

  const now = input.now ?? Date.now();
  const deliveredDrinks = input.orders.filter(
    (order) => order.status === "delivered" && isBarDrinkOrder(order)
  );
  if (deliveredDrinks.length < input.partySize) return null;

  const latest = [...deliveredDrinks].sort(
    (a, b) =>
      new Date(b.delivered_at ?? b.created_at).getTime() -
      new Date(a.delivered_at ?? a.created_at).getTime()
  )[0];
  if (!latest) return null;

  const sinceDelivered = minutesAgo(
    latest.delivered_at ?? latest.created_at,
    now
  );
  if (sinceDelivered < DRINK_REFILL_DELIVERED_MIN_MINUTES) return null;

  const roundDrink = topDeliveredDrinkName(input.orders);
  if (!roundDrink) return null;

  return {
    kind: "round_two",
    suggestedRoundDrink: roundDrink,
    partySize: input.partySize,
    prompt: `Party of ${input.partySize} finished drinks — suggest round of ${roundDrink}.`,
  };
}

/** @deprecated Use detectDrinkRefillTrigger */
export const detectDrinkRefillSuggestTrigger = detectDrinkRefillTrigger;

/** Happy hour active — mention special drink pricing in conversation. */
export function detectHappyHourUpsellTrigger(input: {
  happyHourActive?: boolean;
  sessionPhase?: SessionPhase | null;
  isShown: () => boolean;
}): ProactiveTriggerMatch | null {
  if (!input.happyHourActive) return null;
  if (input.isShown()) return null;
  if (
    input.sessionPhase !== "browsing" &&
    input.sessionPhase !== "ordering" &&
    input.sessionPhase !== "waiting" &&
    input.sessionPhase !== "latent"
  ) {
    return null;
  }

  return {
    kind: "happy_hour_upsell",
    happyHourActive: true,
    prompt: "Happy hour active — mention special drink pricing naturally.",
  };
}

export function detectDessertTrigger(
  orders: AiGuestOrder[],
  isShown: () => boolean,
  now = Date.now(),
  options?: {
    minMinutes?: number;
    maxMinutes?: number | null;
    preparingMinMinutes?: number;
  }
): ProactiveTriggerMatch | null {
  if (isShown() || hasDessertInOrders(orders)) return null;
  if (!hasMainCourseInOrders(orders)) return null;

  const minMinutes = options?.minMinutes ?? 15;
  const maxMinutes = options?.maxMinutes ?? 45;
  const preparingMinMinutes = options?.preparingMinMinutes ?? minMinutes;

  const delivered = orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );

  const latestDelivered = delivered[0];
  if (latestDelivered) {
    const reference = latestDelivered.delivered_at ?? latestDelivered.created_at;
    const mins = minutesAgo(reference, now);
    if (mins >= minMinutes && (maxMinutes == null || mins <= maxMinutes)) {
      return {
        kind: "dessert",
        prompt: `Gast hat gegessen: ${formatPastItems(delivered)}. Empfehle Dessert.`,
      };
    }
  }

  const preparing = orders
    .filter((order) => order.status === "preparing")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const latestPreparing = preparing[0];
  if (!latestPreparing) return null;

  const preparingMins = minutesAgo(latestPreparing.created_at, now);
  if (preparingMins < preparingMinMinutes) return null;

  return {
    kind: "dessert",
    orderId: latestPreparing.id,
    prompt: `Gast wartet auf Hauptgang (${formatOrderItems(latestPreparing)}). Empfehle Dessert für später.`,
  };
}

/** ADR-040 T4 — enforce dessert posture from mealStage + GMM (no minute trigger). */
export function resolveEnforceDessertPosture(input: {
  orders: AiGuestOrder[];
  mental: GuestMentalModel;
}): ProactiveTriggerMatch | null {
  if (hasDessertInOrders(input.orders)) return null;
  if (!hasMainCourseInOrders(input.orders)) return null;
  if (input.mental.mealStage !== "dessert_window") return null;
  if (input.mental.predictedNeed !== "wants_dessert") return null;

  const delivered = input.orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );

  return {
    kind: "dessert",
    orderId: delivered[0]?.id,
    prompt: delivered.length
      ? `Gast hat gegessen: ${formatPastItems(delivered)}. Empfehle Dessert.`
      : "Empfehle Dessert.",
  };
}

/** Proactive guest ETA when kitchen just clicked Preparing (KDS → Denis). */
export const PREPARING_NOTIFY_WINDOW_MS = 3 * 60_000;

export function detectOrderPreparingNotifyTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now()
): ProactiveTriggerMatch | null {
  const candidate = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (order.status !== "preparing") return false;
      if (!isKitchenFoodOrder(order)) return false;
      const preparingAt = order.preparing_at;
      if (!preparingAt) return false;
      const elapsed = now - new Date(preparingAt).getTime();
      return elapsed >= 0 && elapsed <= PREPARING_NOTIFY_WINDOW_MS;
    })
    .sort(
      (a, b) =>
        new Date(b.preparing_at ?? b.created_at).getTime() -
        new Date(a.preparing_at ?? a.created_at).getTime()
    )[0];

  if (!candidate) return null;

  const remaining =
    candidate.estimated_prep_minutes ??
    estimateRemainingPrepMinutes(candidate, now);
  const itemsLabel = formatOrderItems(candidate);

  return {
    kind: "order_eta_update",
    orderId: candidate.id,
    remainingEtaMinutes: remaining,
    estimatedPrepMinutes: candidate.estimated_prep_minutes ?? null,
    prepEstimateConfidence: candidate.prep_estimate_confidence ?? "none",
    orderItemsLabel: itemsLabel,
    prompt: `${itemsLabel} — kitchen started prep, notify guest ~${remaining} min.`,
  };
}

/** Proactive ETA refresh when prep exceeds 1.5× estimate. */
export function detectOrderEtaUpdateTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now(),
  fallbackMinutes = DEFAULT_LATE_FALLBACK_MINUTES
): ProactiveTriggerMatch | null {
  const waiting = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (!isKitchenWaitStatus(order.status)) return false;
      if (!isKitchenFoodOrder(order)) return false;
      return isOrderPastEtaMultiplier(order, now, ORDER_ETA_UPDATE_MULTIPLIER, fallbackMinutes);
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const order = waiting[0];
  if (!order) return null;

  const mins = Math.floor(minutesAgo(order.created_at, now));
  const remaining = estimateRemainingPrepMinutes(order, now);
  const itemsLabel = formatOrderItems(order);

  return {
    kind: "order_eta_update",
    orderId: order.id,
    waitMinutes: mins,
    remainingEtaMinutes: remaining,
    estimatedPrepMinutes: order.estimated_prep_minutes ?? null,
    prepEstimateConfidence: order.prep_estimate_confidence ?? "none",
    orderItemsLabel: itemsLabel,
    prompt: `${itemsLabel} — prep >1.5× ETA, guest waiting ${mins} min, ~${remaining} min left.`,
  };
}

/** @deprecated use detectOrderEtaUpdateTrigger — kept for legacy callers */
export function detectOrderDelayTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now(),
  thresholdMinutes = DEFAULT_LATE_FALLBACK_MINUTES
): ProactiveTriggerMatch | null {
  const match = detectOrderEtaUpdateTrigger(
    orders,
    isShown,
    now,
    thresholdMinutes
  );
  if (!match) return null;
  return { ...match, kind: "order_eta_update" };
}

/** Strong delay — ETA multiplier exceeded; may suggest drink while waiting. */
export function detectSlowKitchenTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now()
): ProactiveTriggerMatch | null {
  const waiting = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (!isKitchenWaitStatus(order.status)) return false;
      if (!isKitchenFoodOrder(order)) return false;
      return (
        minutesAgo(order.created_at, now) >=
        delayThresholdMinutes(order, DEFAULT_LATE_FALLBACK_MINUTES)
      );
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const order = waiting[0];
  if (!order) return null;

  const mins = Math.floor(minutesAgo(order.created_at, now));
  const threshold = delayThresholdMinutes(
    order,
    DEFAULT_LATE_FALLBACK_MINUTES
  );
  const remaining = estimateRemainingPrepMinutes(order, now);
  const drinkActive = hasActiveDrinkOrder(orders);
  const itemsLabel = formatOrderItems(order);

  return {
    kind: "slow_kitchen",
    orderId: order.id,
    waitMinutes: mins,
    remainingEtaMinutes: remaining,
    estimatedPrepMinutes: order.estimated_prep_minutes ?? null,
    prepEstimateConfidence: order.prep_estimate_confidence ?? "none",
    delaySeverity: mins >= threshold + 10 ? "high" : "medium",
    orderItemsLabel: itemsLabel,
    prompt: drinkActive
      ? `${itemsLabel} waiting ${mins} min (~${remaining} min left); do not suggest drinks — guest already has an active drink order.`
      : `${itemsLabel} waiting ${mins} min (~${remaining} min left). offer a drink while the guest waits.`,
  };
}

/** Food order ready — push + chat notify (backup when world tell missed). */
export function detectOrderReadyNotifyTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean
): ProactiveTriggerMatch | null {
  const ready = orders
    .filter(
      (order) =>
        !isShown(order.id) &&
        order.status === "ready" &&
        isKitchenFoodOrder(order)
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const order = ready[0];
  if (!order) return null;

  const itemsLabel = formatOrderItems(order);
  return {
    kind: "order_ready_notify",
    orderId: order.id,
    orderItemsLabel: itemsLabel,
    prompt: `${itemsLabel} ready — push + chat notify guest immediately.`,
  };
}

/** @deprecated alias — use detectOrderReadyNotifyTrigger */
export function detectOrderReadyTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean
): ProactiveTriggerMatch | null {
  const match = detectOrderReadyNotifyTrigger(orders, isShown);
  if (!match) return null;
  return { ...match, kind: "order_ready" };
}

/** Venue backlog high — warn guest before they order (browsing only). */
export function detectKitchenBusyTrigger(input: {
  hasSessionOrders: boolean;
  sessionPhase?: SessionPhase | null;
  kitchenPendingCount: number;
  estimatedWaitMinutes: number | null;
  kdsStress?: "normal" | "high" | null;
  isShown: () => boolean;
}): ProactiveTriggerMatch | null {
  if (input.isShown()) return null;
  if (input.hasSessionOrders) return null;
  if (
    input.sessionPhase !== "browsing" &&
    input.sessionPhase !== "latent" &&
    input.sessionPhase != null
  ) {
    return null;
  }

  const busyByCount = input.kitchenPendingCount >= KITCHEN_BUSY_PENDING_THRESHOLD;
  const busyByWait =
    input.estimatedWaitMinutes != null && input.estimatedWaitMinutes >= 12;
  const busyByStress = input.kdsStress === "high";

  if (!busyByCount && !busyByWait && !busyByStress) return null;

  return {
    kind: "kitchen_busy",
    kitchenBacklogPendingCount: input.kitchenPendingCount,
    backlogLevel: resolveKitchenBacklogLevel(input.kitchenPendingCount),
    estimatedPrepMinutes: input.estimatedWaitMinutes,
    prompt: `Kitchen busy — ${input.kitchenPendingCount} pending, ~${input.estimatedWaitMinutes ?? "?"} min wait.`,
  };
}

/** Backlog >5 pending — guest ordering food: offer wait vs proceed. */
export function detectKitchenBusyPreorderTrigger(input: {
  sessionPhase?: SessionPhase | null;
  kitchenPendingCount: number;
  estimatedWaitMinutes: number | null;
  hasFoodInCart?: boolean;
  isShown: () => boolean;
}): ProactiveTriggerMatch | null {
  if (input.isShown()) return null;
  if (input.sessionPhase !== "ordering") return null;
  if (!input.hasFoodInCart) return null;
  if (input.kitchenPendingCount <= 5) return null;

  const wait =
    input.estimatedWaitMinutes ??
    Math.max(10, Math.round(input.kitchenPendingCount * 1.5));

  return {
    kind: "kitchen_busy_preorder",
    kitchenBacklogPendingCount: input.kitchenPendingCount,
    backlogLevel: resolveKitchenBacklogLevel(input.kitchenPendingCount),
    estimatedPrepMinutes: wait,
    remainingEtaMinutes: wait,
    prompt: `Kitchen busy (${input.kitchenPendingCount} pending) — guest ordering food, confirm wait ~${wait} min or defer.`,
  };
}

/** More than 2 tables waiting beyond threshold — staff escalation. */
export function detectMultiTableDelayAlert(
  tables: KitchenTableWait[],
  options?: {
    thresholdMinutes?: number;
    minTables?: number;
  }
): { message: string; delayedTables: KitchenTableWait[] } | null {
  const thresholdMinutes =
    options?.thresholdMinutes ?? KITCHEN_STAFF_ESCALATION_MINUTES;
  const minTables = options?.minTables ?? KITCHEN_STAFF_ESCALATION_MIN_TABLES;

  const delayed = tables.filter(
    (table) => table.waitMinutes >= thresholdMinutes
  );
  if (delayed.length < minTables) return null;

  const names = delayed.map((table) => table.tableName).join(", ");
  return {
    message: `${delayed.length} stola čekaju >${thresholdMinutes} min (${names}) — kuhinja kasni, proveri pod.`,
    delayedTables: delayed,
  };
}

/** @deprecated alias — use detectMultiTableDelayAlert */
export function detectKitchenStaffEscalation(
  tables: KitchenTableWait[],
  options?: {
    thresholdMinutes?: number;
    minTables?: number;
  }
): { message: string; delayedTables: KitchenTableWait[] } | null {
  return detectMultiTableDelayAlert(tables, options);
}

export function detectWelcomeBackTrigger(
  orders: AiGuestOrder[],
  lastVisitMs: number | null,
  isShown: (visitTimestamp: string) => boolean,
  now = Date.now()
): ProactiveTriggerMatch | null {
  if (!lastVisitMs || now - lastVisitMs <= 5 * MS_MINUTE) return null;

  const completed = orders.filter((order) => order.status === "delivered");
  if (!completed.length) return null;

  const visitTimestamp = String(lastVisitMs);
  if (isShown(visitTimestamp)) return null;

  return {
    kind: "welcome_back",
    visitTimestamp,
    prompt: `Gast kommt zurueck. Hatte: ${formatPastItems(completed)}. Empfehle etwas Neues.`,
  };
}

const REVIEW_DELAY_BYPASS_MOMENTS: ReviewTriggerMoment[] = [
  "after_compliment",
  "after_tip",
  "post_recovery",
];

function reviewDelayBypassed(moment: ReviewTriggerMoment | null): boolean {
  return moment != null && REVIEW_DELAY_BYPASS_MOMENTS.includes(moment);
}

export function detectReviewTrigger(input: {
  orders: AiGuestOrder[];
  phase: SessionPhase;
  billSettled: boolean;
  experienceScore: number;
  frustrationLevel: GuestFrustrationLevel;
  googleReviewUrl: string | null;
  lastReviewPromptDate: string | null;
  lastReviewDismissDate: string | null;
  paidAnchorAt: string | null;
  language?: string | null;
  now?: number;
  isShown?: () => boolean;
  mealStage?: string | null;
  waitingForBill?: boolean;
  tipRecorded?: boolean;
  lastGuestMessage?: string | null;
  kdsStress?: "normal" | "high";
  sessionDurationMinutes?: number | null;
  recoveryCompleted?: boolean;
  postRecoveryEligible?: boolean;
  guestSentimentAfterRecovery?: import("@/lib/commerce/experience/resolve-experience-moment").FeedbackSentiment | null;
  recoveryIssueLabel?: string | null;
}): ProactiveTriggerMatch | null {
  const now = input.now ?? Date.now();
  if (input.phase !== "settling" && input.phase !== "closed") return null;
  if (!input.billSettled) return null;
  if (!input.paidAnchorAt) return null;
  if (input.isShown?.()) return null;

  const momentResult = detectOptimalReviewMoment({
    phase: input.phase,
    mealStage: input.mealStage,
    billSettled: input.billSettled,
    waitingForBill: input.waitingForBill,
    tipRecorded: input.tipRecorded,
    kdsStress: input.kdsStress,
    sessionDurationMinutes: input.sessionDurationMinutes,
    recoveryCompleted: input.recoveryCompleted,
    postRecoveryEligible: input.postRecoveryEligible,
    lastGuestMessage: input.lastGuestMessage,
  });

  if (!isReviewMomentReady(momentResult)) return null;

  const recovery = resolveRecoveryReviewState({
    experienceScore: input.experienceScore,
    recoveryCompleted: Boolean(input.recoveryCompleted),
    recoveryIssueLabel: input.recoveryIssueLabel,
    guestSentimentAfterRecovery: input.guestSentimentAfterRecovery,
    language: input.language,
  });

  const postRecoveryGoogle =
    recovery.eligibleForGoogleAfterRecovery &&
    momentResult.moment === "post_recovery";

  const eligibility = resolveReviewEligibility({
    experienceScore: input.experienceScore,
    frustrationLevel: input.frustrationLevel,
    lastReviewPromptDate: input.lastReviewPromptDate,
    lastReviewDismissDate: input.lastReviewDismissDate,
    googleReviewUrl: input.googleReviewUrl,
    nowMs: now,
  });

  let route: "google" | "internal" | "none" = "none";
  if (postRecoveryGoogle) {
    route = "google";
  } else if (eligibility.eligible) {
    route = eligibility.route === "google" ? "google" : "internal";
  }

  if (route === "none") return null;

  const delayOk =
    reviewDelayOpen(input.paidAnchorAt, eligibility.delay, now) ||
    reviewDelayBypassed(momentResult.moment);
  if (!delayOk) return null;

  if (route === "google" && !input.googleReviewUrl?.trim()) return null;

  const targetOrder = input.orders[input.orders.length - 1];
  if (!targetOrder) return null;

  const language = input.language ?? "sr";
  const orderItems = input.orders.flatMap((order) =>
    (order.order_items ?? []).map((item) => ({
      productName: item.product_name,
      menuSection: item.menu_section,
    }))
  );
  const contentSuggestion = buildReviewContentSuggestion({
    orderItems,
    language,
  });
  const gated = buildSentimentGatedReviewContent({
    experienceScore: postRecoveryGoogle ? 9 : input.experienceScore,
    language,
    contentSuggestion,
    triggerMoment: momentResult.moment,
  });

  const prompt =
    recovery.followUpMessage && postRecoveryGoogle
      ? `${recovery.followUpMessage} ${gated.message}`
      : gated.message;

  return {
    kind: route === "google" ? "google_review" : "internal_feedback",
    orderId: targetOrder.id,
    prompt,
    triggerMoment: momentResult.moment ?? undefined,
    reviewRoute: route,
    contentSuggestion: contentSuggestion?.suggestionLine,
  };
}

/** Prompt 78 — staff floor alert when live experience score drops below 4. */
export function detectLowExperienceStaffAlert(input: {
  tableName: string;
  experienceScore: number;
  language?: string | null;
  isShown?: () => boolean;
}): {
  kind: "staff_low_experience";
  tableName: string;
  message: string;
  detail: string;
} | null {
  if (input.isShown?.()) return null;
  if (!shouldEmitLowExperienceStaffAlert(input.experienceScore)) return null;

  return {
    kind: "staff_low_experience",
    tableName: input.tableName,
    message: buildLowExperienceStaffAlertMessage({
      tableName: input.tableName,
      score: input.experienceScore,
      language: input.language,
    }),
    detail: `experience_score=${input.experienceScore.toFixed(1)}`,
  };
}

export function detectProactiveTrigger(
  orders: AiGuestOrder[],
  options: {
    isPairingShown: (orderId: string) => boolean;
    isDessertShown: () => boolean;
    isWelcomeShown: (visitTimestamp: string) => boolean;
    lastVisitMs: number | null;
    now?: number;
  }
): ProactiveTriggerMatch | null {
  const now = options.now ?? Date.now();

  return (
    detectPairingTrigger(orders, options.isPairingShown, now) ??
    detectDessertTrigger(orders, options.isDessertShown, now) ??
    detectWelcomeBackTrigger(
      orders,
      options.lastVisitMs,
      options.isWelcomeShown,
      now
    )
  );
}
