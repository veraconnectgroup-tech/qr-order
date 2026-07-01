import type { CartItem } from "@/hooks/use-cart";
import { analyzeCartSnapshot } from "@/lib/denis/kernel/cart-signals";
import {
  mergeDeviceCartSnapshots,
  type DeviceContext,
} from "@/lib/denis/actor/cross-device-sync";

export type GuestManualCartSnapshot = {
  revision: number;
  updatedAt: string;
  /** Derived metrics — present on client-built snapshots (M11). */
  itemCount?: number;
  subtotal?: number;
  hasFood?: boolean;
  hasDrinks?: boolean;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    serveSize: string | null;
    lineTotal: number;
    modifierIds?: string[];
    menuSection?: string | null;
  }>;
};

export const CART_READY_MIN_ITEMS = 3;
export const CART_READY_IDLE_MS = 5 * 60 * 1000;
export const FULL_CART_RECOVERY_MS = 10 * 60 * 1000;

export type CartAwarenessKind =
  | "drink_pairing"
  | "ready_to_order"
  | "cart_recovery"
  | "cart_abandonment_prevention";

export type CartAwarenessNudge = {
  kind: CartAwarenessKind;
  message: string;
  dismissKey: string;
  productId?: string;
  productName?: string;
};

function isEnglish(language: string | null | undefined): boolean {
  return (language?.trim().toLowerCase() ?? "sr").startsWith("en");
}

/** Build Denis manual cart payload from guest Zustand cart (M11). */
export function buildManualCartSnapshot(
  items: CartItem[],
  revision: number
): GuestManualCartSnapshot {
  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
  const signals = analyzeCartSnapshot(
    items.map((item) => ({ menuSection: item.menuSection ?? null }))
  );

  return {
    revision,
    updatedAt: new Date().toISOString(),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: Number(subtotal.toFixed(2)),
    hasFood: signals.hasFood,
    hasDrinks: signals.hasDrinks,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      serveSize: item.serveSize ?? null,
      lineTotal: item.itemTotal,
      modifierIds: item.modifiers.map((modifier) => modifier.modifierId),
      menuSection: item.menuSection ?? null,
    })),
  };
}

export function manualCartRevision(items: CartItem[], cartBump: number): number {
  if (cartBump > 0) return cartBump;
  return items.reduce((sum, item) => sum + item.quantity, 0) * 1000 + items.length;
}

export function shouldSuppressOfferForProduct(
  productId: string,
  removedProductIds: readonly string[]
): boolean {
  return removedProductIds.includes(productId);
}

/** Local cart awareness — drink gap, ready-to-order idle, removed-item guard. */
export function deriveCartAwarenessNudge(input: {
  snapshot: GuestManualCartSnapshot;
  removedProductIds: readonly string[];
  idleMs: number;
  dismissedKeys: ReadonlySet<string>;
  language?: string | null;
  /** Optional VKG pairing target when food lacks drink. */
  suggestedDrink?: { productId: string; productName: string } | null;
}): CartAwarenessNudge | null {
  const english = isEnglish(input.language);
  const { snapshot } = input;
  const itemCount =
    snapshot.itemCount ??
    snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  const hasFood =
    snapshot.hasFood ??
    snapshot.items.some((item) => {
      const section = (item.menuSection ?? "").toLowerCase();
      return section !== "drinks" && section !== "bar";
    });
  const hasDrinks =
    snapshot.hasDrinks ??
    snapshot.items.some((item) => {
      const section = (item.menuSection ?? "").toLowerCase();
      return section === "drinks" || section === "bar";
    });

  if (itemCount <= 0) return null;

  const primaryFood = snapshot.items.find((item) => {
    const section = (item.menuSection ?? "").toLowerCase();
    return section !== "drinks" && section !== "bar";
  });

  if (
    hasFood &&
    !hasDrinks &&
    primaryFood &&
    !shouldSuppressOfferForProduct(primaryFood.productId, input.removedProductIds)
  ) {
    const dismissKey = `cart_sense:drink_pairing:${primaryFood.productId}`;
    if (input.dismissedKeys.has(dismissKey)) return null;

    const drink = input.suggestedDrink;
    const message = drink
      ? english
        ? `Drink with ${primaryFood.productName}? ${drink.productName} pairs well.`
        : `Piće uz ${primaryFood.productName}? ${drink.productName} se lepo slaže.`
      : english
        ? `Drink with ${primaryFood.productName}?`
        : `Piće uz ${primaryFood.productName}?`;

    return {
      kind: "drink_pairing",
      message,
      dismissKey,
      productId: drink?.productId ?? primaryFood.productId,
      productName: drink?.productName ?? primaryFood.productName,
    };
  }

  if (itemCount >= CART_READY_MIN_ITEMS && input.idleMs >= CART_READY_IDLE_MS) {
    const dismissKey = "cart_sense:ready_to_order";
    if (input.dismissedKeys.has(dismissKey)) return null;

    return {
      kind: "ready_to_order",
      message: english
        ? "Ready to place your order?"
        : "Spremni za narudžbinu?",
      dismissKey,
    };
  }

  return null;
}

/** Party mode — merge peer device manual snapshots into one visible cart. */
export function mergePartyManualSnapshots(
  devices: DeviceContext[]
): GuestManualCartSnapshot["items"] {
  return mergeDeviceCartSnapshots(devices).map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    serveSize: line.serveSize ?? null,
    lineTotal: 0,
    menuSection: null,
  }));
}
