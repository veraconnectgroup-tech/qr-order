import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";
import { roundMoney } from "@/lib/tax/vat";

export type BulkPriceUpdateMode = "set" | "increase_percent" | "increase_amount";

export type BulkPriceUpdateInput = {
  orgId: string;
  locationIds: string[];
  productNameMatch: string;
  mode: BulkPriceUpdateMode;
  value: number;
};

export type BulkPriceUpdateResult = {
  productsUpdated: number;
  locationsAffected: number;
};

function applyPrice(current: number, mode: BulkPriceUpdateMode, value: number): number {
  if (mode === "set") {
    return roundMoney(value);
  }
  if (mode === "increase_percent") {
    return roundMoney(current * (1 + value / 100));
  }
  return roundMoney(current + value);
}

export async function bulkUpdateProductPrice(
  admin: SupabaseClient,
  input: BulkPriceUpdateInput
): Promise<BulkPriceUpdateResult> {
  const match = input.productNameMatch.trim().toLowerCase();
  if (!match) {
    throw new Error("Product name match is required.");
  }
  if (!input.locationIds.length) {
    throw new Error("At least one location is required.");
  }

  const { data: locations } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", input.orgId)
    .in("id", input.locationIds);

  const validIds = new Set(
    (locations ?? []).map((row) => (row as { id: string }).id)
  );
  const targetIds = input.locationIds.filter((id) => validIds.has(id));
  if (!targetIds.length) {
    throw new Error("No valid locations in organization.");
  }

  const { data: products, error } = await admin
    .from("products")
    .select("id, location_id, name, price")
    .in("location_id", targetIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Products load failed: ${error.message}`);
  }

  const toUpdate = (products ?? []).filter((row) => {
    const p = row as { name: string };
    return p.name.trim().toLowerCase().includes(match);
  }) as Array<{ id: string; location_id: string; name: string; price: number }>;

  const affectedLocations = new Set<string>();

  for (const product of toUpdate) {
    const newPrice = applyPrice(Number(product.price), input.mode, input.value);
    const { error: updateError } = await admin
      .from("products")
      .update({ price: newPrice, updated_at: new Date().toISOString() } as never)
      .eq("id", product.id);

    if (updateError) {
      throw new Error(`Price update failed: ${updateError.message}`);
    }
    affectedLocations.add(product.location_id);
  }

  for (const locationId of affectedLocations) {
    await invalidateMenuCache(locationId);
  }

  return {
    productsUpdated: toUpdate.length,
    locationsAffected: affectedLocations.size,
  };
}
