import type { AiGuestOrder } from "@/lib/ai/order-context";

export type ProactiveTriggerKind = "pairing" | "dessert" | "welcome_back";

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
  now = Date.now()
): ProactiveTriggerMatch | null {
  if (isShown() || hasDessertInOrders(orders)) return null;

  const delivered = orders
    .filter((order) => order.status === "delivered")
    .sort(
      (a, b) =>
        new Date(b.delivered_at ?? b.created_at).getTime() -
        new Date(a.delivered_at ?? a.created_at).getTime()
    );

  const latest = delivered[0];
  if (!latest) return null;

  const reference = latest.delivered_at ?? latest.created_at;
  const mins = minutesAgo(reference, now);
  if (mins < 15 || mins > 30) return null;

  const eaten = delivered.flatMap((order) => order.order_items);
  if (!eaten.length) return null;

  return {
    kind: "dessert",
    prompt: `Gast hat gegessen: ${formatPastItems(delivered)}. Empfehle Dessert.`,
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
