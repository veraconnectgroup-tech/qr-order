import type { CartItem } from "@/hooks/use-cart";

export type GuestManualCartSnapshot = {
  revision: number;
  updatedAt: string;
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

/** Build Denis manual cart payload from guest Zustand cart (M11). */
export function buildManualCartSnapshot(
  items: CartItem[],
  revision: number
): GuestManualCartSnapshot {
  return {
    revision,
    updatedAt: new Date().toISOString(),
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
