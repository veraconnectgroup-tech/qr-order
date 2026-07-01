import type { MenuEngineeringOrderRow } from "@/lib/denis/platform/menu-engineering";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ORDER_ROWS = 15_000;

/** Delivered order lines for menu engineering (K2). */
export async function loadMenuEngineeringOrderRows(
  admin: SupabaseClient,
  input: {
    locationId: string;
    lookbackDays: number;
  }
): Promise<MenuEngineeringOrderRow[]> {
  const since = new Date(
    Date.now() - input.lookbackDays * 86_400_000
  ).toISOString();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
      order_items (product_id, product_name, quantity, total)
    `
    )
    .eq("location_id", input.locationId)
    .eq("status", "delivered")
    .gte("created_at", since)
    .limit(MAX_ORDER_ROWS);

  if (error) {
    logger.warn("loadMenuEngineeringOrderRows failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return [];
  }

  const rows: MenuEngineeringOrderRow[] = [];

  for (const order of (data ?? []) as Array<{
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      quantity: number;
      total: number | string | null;
    }> | null;
  }>) {
    for (const item of order.order_items ?? []) {
      const productId = item.product_id?.trim();
      const productName = item.product_name?.trim();
      if (!productId || !productName) continue;

      const total = Number(item.total ?? 0);
      rows.push({
        productId,
        productName,
        quantity: Math.max(1, Number(item.quantity) || 1),
        revenueCents: Math.round(total * 100),
      });
    }
  }

  return rows;
}
