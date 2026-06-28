import type { AiGuestOrder } from "@/lib/ai/order-context";
import { resolveKitchenPrepStation } from "@/lib/denis/venue/ops/kitchen-prep-stations";
import {
  buildVenueKitchenLoad,
  suggestBottleneckAlternative,
} from "@/lib/denis/venue/ops/kitchen-load-model";
import type { SessionPhase } from "@/lib/scene/types";

export type KitchenMindTriggerKind =
  | "preorder_kitchen_heads_up"
  | "cooking_grill_started"
  | "cooking_plating"
  | "station_bottleneck_avoid";

export type KitchenMindTriggerMatch = {
  kind: KitchenMindTriggerKind;
  orderId?: string;
  tableName?: string;
  partySize?: number;
  browseMinutes?: number;
  productName?: string;
  alternativeName?: string;
  alternativeProductId?: string;
  prepMinutes?: number;
  overloadedStation?: string;
  queueDepth?: number;
  orderItemsLabel?: string;
  prompt: string;
};

const MS_MINUTE = 60_000;
const PREORDER_HEADS_UP_BROWSE_MINUTES = 10;
const PREORDER_HEADS_UP_PARTY_SIZE = 6;
const GRILL_STARTED_WINDOW_MINUTES = 3;

function minutesAgo(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / MS_MINUTE;
}

function formatOrderItems(order: AiGuestOrder): string {
  return order.order_items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
      return `${qty}${item.product_name}`;
    })
    .join(", ");
}

/** Guest browsing 10+ min with large party — kitchen heads-up before order. */
export function detectPreorderKitchenHeadsUp(input: {
  browseMinutes: number;
  partySize: number;
  hasSessionOrders: boolean;
  sessionPhase?: SessionPhase | null;
  tableName: string;
  isShown: () => boolean;
}): KitchenMindTriggerMatch | null {
  if (input.isShown()) return null;
  if (input.hasSessionOrders) return null;
  if (input.partySize < PREORDER_HEADS_UP_PARTY_SIZE) return null;
  if (input.browseMinutes < PREORDER_HEADS_UP_BROWSE_MINUTES) return null;
  if (
    input.sessionPhase !== "browsing" &&
    input.sessionPhase !== "latent" &&
    input.sessionPhase != null
  ) {
    return null;
  }

  return {
    kind: "preorder_kitchen_heads_up",
    tableName: input.tableName,
    partySize: input.partySize,
    browseMinutes: input.browseMinutes,
    prompt: `Heads up — ${input.tableName}, ${input.partySize} osoba, ${Math.floor(input.browseMinutes)} min na meniju — verovatno velika narudžbina.`,
  };
}

/** Order just entered preparing with grill items — real-time cooking push. */
export function detectCookingGrillStartedTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean,
  now = Date.now()
): KitchenMindTriggerMatch | null {
  const candidate = orders
    .filter((order) => {
      if (isShown(order.id)) return false;
      if (order.status !== "preparing") return false;
      const hasGrillItem = order.order_items.some(
        (item) =>
          resolveKitchenPrepStation({
            productName: item.product_name,
            productId: item.product_id,
            menuSection: item.menu_section,
          }) === "grill"
      );
      if (!hasGrillItem) return false;
      const preparingAt =
        (order as { preparing_at?: string | null }).preparing_at ??
        order.created_at;
      return minutesAgo(preparingAt, now) <= GRILL_STARTED_WINDOW_MINUTES;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (!candidate) return null;

  const itemsLabel = formatOrderItems(candidate);
  return {
    kind: "cooking_grill_started",
    orderId: candidate.id,
    orderItemsLabel: itemsLabel,
    prompt: `${itemsLabel} — grill started, notify guest with fire emoji.`,
  };
}

/** Order ready — plating / serving push (distinct from generic ready). */
export function detectCookingPlatingTrigger(
  orders: AiGuestOrder[],
  isShown: (orderId: string) => boolean
): KitchenMindTriggerMatch | null {
  const ready = orders
    .filter(
      (order) =>
        !isShown(order.id) &&
        order.status === "ready" &&
        order.order_items.some(
          (item) =>
            item.menu_section === "food" || item.menu_section === "desserts"
        )
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (!ready) return null;

  const itemsLabel = formatOrderItems(ready);
  return {
    kind: "cooking_plating",
    orderId: ready.id,
    orderItemsLabel: itemsLabel,
    prompt: `${itemsLabel} — plating now, notify guest immediately.`,
  };
}

/** Grill full + burger in cart — positive alternative redirect. */
export function detectStationBottleneckAvoidanceTrigger(input: {
  cartItems: Array<{
    productId: string;
    productName: string;
    menuSection?: string | null;
  }>;
  venueOrders: AiGuestOrder[];
  sessionPhase?: SessionPhase | null;
  isShown: (key: string) => boolean;
}): KitchenMindTriggerMatch | null {
  if (
    input.sessionPhase !== "browsing" &&
    input.sessionPhase !== "ordering" &&
    input.sessionPhase != null
  ) {
    return null;
  }

  const load = buildVenueKitchenLoad(input.venueOrders);

  for (const item of input.cartItems) {
    const key = `station_bottleneck:${item.productId}`;
    if (input.isShown(key)) continue;

    const suggestion = suggestBottleneckAlternative({
      productName: item.productName,
      productId: item.productId,
      menuSection: item.menuSection,
      load,
    });

    if (!suggestion) continue;

    return {
      kind: "station_bottleneck_avoid",
      productName: suggestion.insteadOf,
      alternativeName: suggestion.alternativeName,
      alternativeProductId: suggestion.alternativeProductId,
      prepMinutes: suggestion.prepMinutes,
      overloadedStation: suggestion.overloadedStation,
      queueDepth: suggestion.queueDepth,
      prompt: `${suggestion.overloadedStation} queue ${suggestion.queueDepth} — suggest ${suggestion.alternativeName} (~${suggestion.prepMinutes} min) instead of ${suggestion.insteadOf}.`,
    };
  }

  return null;
}
