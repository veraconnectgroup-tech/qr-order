import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";

export type ProactiveTriggerKind =
  | "pairing"
  | "dessert"
  | "welcome_back"
  | "slow_kitchen";

export type ProactiveTriggerMatch = {
  kind: ProactiveTriggerKind;
  orderId?: string;
  visitTimestamp?: string;
  prompt: string;
};

const MS_MINUTE = 60_000;

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

export function detectOrderDelayTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now(),
  thresholdMinutes = 15
): ProactiveTriggerMatch | null {
  const waiting = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (order.status !== "preparing") return false;
      return minutesAgo(order.created_at, now) >= thresholdMinutes;
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const order = waiting[0];
  if (!order) return null;

  return {
    kind: "slow_kitchen",
    orderId: order.id,
    prompt: `Bestellung #${order.id.slice(0, 8)} wartet seit ${Math.floor(minutesAgo(order.created_at, now))} Minuten.`,
  };
}

export function detectSlowKitchenTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now()
): ProactiveTriggerMatch | null {
  const waiting = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (!["pending", "accepted", "preparing"].includes(order.status)) {
        return false;
      }
      return minutesAgo(order.created_at, now) >= 15;
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const order = waiting[0];
  if (!order) return null;

  const mins = Math.floor(minutesAgo(order.created_at, now));

  return {
    kind: "slow_kitchen",
    orderId: order.id,
    prompt: `Bestellung #${order.id.slice(0, 8)} wartet seit ${mins} Minuten in der Küche. Schlage ein Getraenk vor während der Gast wartet.`,
  };
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
