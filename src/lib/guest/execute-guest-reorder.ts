import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { MenuSection } from "@/lib/menu-section";
import { isMenuSection } from "@/lib/menu-section";
import { readApiErrorMessage } from "@/lib/api-error-client";

export type GuestReorderCartItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  menuSection: MenuSection;
  productTaxRate: number;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
};

export type GuestReorderResult = {
  cartItems: GuestReorderCartItem[];
  skipped: string[];
};

/** Fetch reorder lines from Order Core — shared by dock and order tracker (P1). */
export async function fetchGuestReorderCart(input: {
  orderId: string;
  sessionToken: string;
  tableToken: string;
}): Promise<GuestReorderResult> {
  const res = await fetch(`/api/orders/${input.orderId}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: input.sessionToken,
      tableToken: input.tableToken,
    }),
  });
  const json = (await res.json()) as {
    data?: GuestReorderResult;
    error?: string;
  };

  if (!res.ok || !json.data) {
    throw new Error(readApiErrorMessage(json, res.status, "Reorder failed"));
  }

  return {
    cartItems: (json.data.cartItems ?? []).map((item) => ({
      ...item,
      menuSection: isMenuSection(item.menuSection)
        ? item.menuSection
        : "food",
    })),
    skipped: json.data.skipped ?? [],
  };
}

export function mapOrderFactsToAiGuestOrders(
  orders: Array<{
    id: string;
    status: string;
    createdAt: string;
    deliveredAt?: string | null;
    items: Array<{
      productId?: string | null;
      productName: string;
      menuSection?: string | null;
      quantity: number;
    }>;
  }>
): AiGuestOrder[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.createdAt,
    delivered_at: order.deliveredAt ?? null,
    order_items: order.items.map((item) => ({
      product_id: item.productId ?? null,
      product_name: item.productName,
      unit_price: 0,
      quantity: item.quantity,
      menu_section: (isMenuSection(item.menuSection ?? "")
        ? item.menuSection
        : "food") as MenuSection,
    })),
  }));
}
