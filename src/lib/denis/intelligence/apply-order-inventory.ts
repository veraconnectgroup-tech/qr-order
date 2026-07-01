import type { SupabaseClient } from "@supabase/supabase-js";
import { guestSubstitutionHint } from "@/lib/denis/intelligence/inventory-awareness";
import { loadVenueKnowledgeGraph, substituteFor } from "@/lib/denis/kernel/vkg";
import { dispatchInventoryAlerts } from "@/lib/denis/notifications/dispatch-inventory-alerts";
import { emitDenisStockDepleted } from "@/lib/webhooks/emit-denis-extended-events";
import { logger } from "@/lib/logger";

type OrderLine = {
  productId: string;
  productName: string;
  quantity: number;
};

type ProductStockRow = {
  id: string;
  name: string;
  track_stock: boolean;
  stock_quantity: number | null;
  is_available: boolean;
};

/** Decrement tracked stock after order; auto-86 + staff alerts at zero (W3). */
export async function applyOrderInventoryDecrement(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    lines: OrderLine[];
  }
): Promise<{ depletedProductIds: string[] }> {
  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  if (productIds.length === 0) return { depletedProductIds: [] };

  const { data: rows } = await admin
    .from("products")
    .select("id, name, track_stock, stock_quantity, is_available")
    .eq("location_id", input.locationId)
    .in("id", productIds)
    .eq("track_stock", true)
    .is("deleted_at", null);

  const byId = new Map(
    ((rows ?? []) as ProductStockRow[]).map((row) => [row.id, row])
  );

  const depletedProductIds: string[] = [];

  for (const line of input.lines) {
    const product = byId.get(line.productId);
    if (!product || product.stock_quantity == null) continue;

    const previousStock = product.stock_quantity;
    const nextStock = Math.max(0, previousStock - line.quantity);
    product.stock_quantity = nextStock;

    const patch: Record<string, unknown> = {
      stock_quantity: nextStock,
      updated_at: new Date().toISOString(),
    };

    if (nextStock <= 0) {
      patch.is_available = false;
      depletedProductIds.push(product.id);

      await emitDenisStockDepleted(admin, {
        locationId: input.locationId,
        productId: product.id,
        productName: product.name,
        previousStock,
      });
    }

    const { error } = await admin
      .from("products")
      .update(patch as never)
      .eq("id", product.id)
      .eq("location_id", input.locationId);

    if (error) {
      logger.warn("inventory.decrement failed", {
        productId: product.id,
        error: error.message,
      });
    }
  }

  if (depletedProductIds.length > 0) {
    await dispatchInventoryAlerts(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      depletedProductIds,
    });
  }

  return { depletedProductIds };
}

/** Guest-safe substitute line when a product is 86'd (VKG substituteFor). */
export async function resolveInventorySubstitutionMessage(input: {
  locationId: string;
  productId: string;
  productName: string;
  unavailableProductIds: string[];
}): Promise<string | null> {
  const graph = await loadVenueKnowledgeGraph(input.locationId);
  const substitutes = substituteFor(graph, input.productId, {
    unavailableProductIds: input.unavailableProductIds,
  });
  const alternative = substitutes[0];
  if (!alternative?.name) return null;

  return guestSubstitutionHint(input.productName, alternative.name);
}
