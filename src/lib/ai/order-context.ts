import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/format";
import type { MenuSection } from "@/lib/menu-section";
import { parseAiGuestOrderRows } from "@/lib/supabase/parse-order-rows";

export type AiGuestOrderItem = {
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  menu_section: MenuSection;
  /** From products.food_tags at order time — sommelier pairing without regex. */
  food_tags?: string[];
};

export type AiGuestOrder = {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  preparing_at?: string | null;
  estimated_prep_minutes?: number | null;
  prep_estimate_confidence?: "none" | "low" | "medium" | "high" | null;
  order_items: AiGuestOrderItem[];
};

export async function loadGuestOrdersForAi(
  admin: SupabaseClient,
  tableId: string,
  sessionToken: string
): Promise<AiGuestOrder[]> {
  const { data: tableSessionByToken } = await admin
    .from("table_sessions")
    .select("id")
    .eq("session_token", sessionToken)
    .eq("table_id", tableId)
    .eq("status", "active")
    .maybeSingle();

  let sessionId = (tableSessionByToken as { id: string } | null)?.id ?? null;

  if (!sessionId) {
    const { data: activeOnTable } = await admin
      .from("table_sessions")
      .select("id")
      .eq("table_id", tableId)
      .eq("status", "active")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    sessionId = (activeOnTable as { id: string } | null)?.id ?? null;
  }

  if (!sessionId) return [];

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `
      id,
      status,
      created_at,
      delivered_at,
      preparing_at,
      estimated_prep_minutes,
      prep_estimate_confidence,
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

  return parseAiGuestOrderRows(orders).map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.created_at,
    delivered_at: order.delivered_at,
    preparing_at: order.preparing_at ?? null,
    estimated_prep_minutes: order.estimated_prep_minutes ?? null,
    prep_estimate_confidence: order.prep_estimate_confidence ?? null,
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
): string {
  const lines: string[] = [];

  for (const order of orders) {
    for (const item of order.order_items) {
      const price = formatPrice(item.unit_price, currency, "de-DE");
      lines.push(
        `- ${item.product_name} (${price}) - Status: ${order.status}`
      );
    }
  }

  if (!lines.length) {
    return [
      "BISHERIGE BESTELLUNGEN DES GASTES:",
      "(none — NO ORDERS SENT TO KITCHEN YET for this table session)",
      "Never claim an order was sent, submitted, or is on its way unless listed above.",
    ].join("\n");
  }

  return [
    "BISHERIGE BESTELLUNGEN DES GASTES:",
    ...lines,
    "Empfehle NICHT was Gast schon bestellt hat.",
  ].join("\n");
}
