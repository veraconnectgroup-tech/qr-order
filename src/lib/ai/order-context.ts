import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/format";
import type { MenuSection } from "@/lib/menu-section";

export type AiGuestOrderItem = {
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  menu_section: MenuSection;
};

export type AiGuestOrder = {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  order_items: AiGuestOrderItem[];
};

type RawOrderItem = {
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  menu_section: MenuSection;
};

type RawOrder = {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  order_items: RawOrderItem[] | null;
};

export async function loadGuestOrdersForAi(
  admin: SupabaseClient,
  tableId: string,
  sessionToken: string
): Promise<AiGuestOrder[]> {
  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("session_token", sessionToken)
    .eq("table_id", tableId)
    .eq("status", "active")
    .maybeSingle();

  if (!tableSession) return [];

  const sessionId = (tableSession as { id: string }).id;

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `
      id,
      status,
      created_at,
      delivered_at,
      order_items (
        product_id,
        product_name,
        unit_price,
        quantity,
        menu_section
      )
    `
    )
    .eq("table_id", tableId)
    .eq("session_id", sessionId)
    .not("status", "in", '("rejected","cancelled")')
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((orders ?? []) as unknown as RawOrder[]).map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.created_at,
    delivered_at: order.delivered_at,
    order_items: (order.order_items ?? []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: Number(item.unit_price),
      quantity: item.quantity,
      menu_section: item.menu_section,
    })),
  }));
}

export function formatOrderContextBlock(
  orders: AiGuestOrder[],
  currency: string
): string | null {
  const lines: string[] = [];

  for (const order of orders) {
    for (const item of order.order_items) {
      const price = formatPrice(item.unit_price, currency, "de-DE");
      lines.push(
        `- ${item.product_name} (${price}) - Status: ${order.status}`
      );
    }
  }

  if (!lines.length) return null;

  return [
    "BISHERIGE BESTELLUNGEN DES GASTES:",
    ...lines,
    "Empfehle NICHT was Gast schon bestellt hat.",
  ].join("\n");
}
