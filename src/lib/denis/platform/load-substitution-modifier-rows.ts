import type { SubstitutionModifierRow } from "@/lib/denis/platform/substitution-intelligence";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ROWS = 15_000;
const LOOKBACK_DAYS = 90;

/** Delivered order lines with notes for substitution learning (K3). */
export async function loadSubstitutionModifierRows(
  admin: SupabaseClient,
  input: {
    locationId: string;
    lookbackDays?: number;
  }
): Promise<SubstitutionModifierRow[]> {
  const lookbackDays = input.lookbackDays ?? LOOKBACK_DAYS;
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
      order_items (
        product_id,
        product_name,
        notes,
        order_item_modifiers (modifier_name)
      )
    `
    )
    .eq("location_id", input.locationId)
    .eq("status", "delivered")
    .gte("created_at", since)
    .limit(MAX_ROWS);

  if (error) {
    logger.warn("loadSubstitutionModifierRows failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return [];
  }

  const rows: SubstitutionModifierRow[] = [];

  for (const order of (data ?? []) as Array<{
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      notes: string | null;
      order_item_modifiers: Array<{ modifier_name: string }> | null;
    }> | null;
  }>) {
    for (const item of order.order_items ?? []) {
      const productId = item.product_id?.trim();
      const productName = item.product_name?.trim();
      if (!productId || !productName) continue;

      rows.push({
        productId,
        productName,
        notes: item.notes,
        modifierNames: (item.order_item_modifiers ?? [])
          .map((row) => row.modifier_name?.trim())
          .filter((name): name is string => Boolean(name)),
      });
    }
  }

  return rows;
}
