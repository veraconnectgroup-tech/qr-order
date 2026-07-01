import type { SupabaseClient } from "@supabase/supabase-js";
import {
  autoUnavailableProductIds,
  evaluateInventory,
  type InventoryAlert,
  type StockLevel,
} from "@/lib/denis/intelligence/inventory-awareness";

type ProductStockRow = {
  id: string;
  name: string;
  track_stock: boolean;
  stock_quantity: number | null;
  is_available: boolean;
};

type OrderItemRow = {
  product_id: string;
  quantity: number;
  created_at: string;
};

export type VenueInventorySnapshot = {
  levels: StockLevel[];
  alerts: InventoryAlert[];
  autoUnavailableProductIds: string[];
};

function localHourInTimezone(timezone: string | null, now = new Date()): number {
  const tz = timezone?.trim() || "Europe/Berlin";
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour);
}

function startOfLocalDayIso(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `${date}T00:00:00.000Z`;
}

async function loadHistoricalDailyAvg(
  admin: SupabaseClient,
  locationId: string,
  lookbackDays = 30
): Promise<Map<string, number>> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();

  const { data: orderRows } = await admin
    .from("orders")
    .select("id, created_at")
    .eq("location_id", locationId)
    .gte("created_at", since)
    .not("status", "in", '("cancelled","rejected")');

  const dayCount = new Map<string, Set<string>>();
  const totals = new Map<string, number>();

  for (const order of orderRows ?? []) {
    const typed = order as { id: string; created_at: string };
    const day = typed.created_at.slice(0, 10);
    if (!dayCount.has(day)) dayCount.set(day, new Set());
    dayCount.get(day)!.add(typed.id);
  }

  const orderIds = (orderRows ?? []).map((row) => (row as { id: string }).id);
  if (orderIds.length === 0) return totals;

  const { data: itemRows } = await admin
    .from("order_items")
    .select("product_id, quantity, created_at")
    .in("order_id", orderIds);

  for (const row of (itemRows ?? []) as OrderItemRow[]) {
    totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + row.quantity);
  }

  const activeDays = Math.max(1, dayCount.size);
  const averages = new Map<string, number>();
  for (const [productId, total] of totals.entries()) {
    averages.set(productId, total / activeDays);
  }

  return averages;
}

/** Load live inventory levels + alerts for a venue (W3). */
export async function loadVenueInventorySnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    timezone?: string | null;
    closingHour?: number;
    now?: Date;
  }
): Promise<VenueInventorySnapshot> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? "Europe/Berlin";
  const closingHour = input.closingHour ?? 24;

  const [{ data: productRows }, historicalDailyAvg, todayStart] =
    await Promise.all([
      admin
        .from("products")
        .select("id, name, track_stock, stock_quantity, is_available")
        .eq("location_id", input.locationId)
        .eq("track_stock", true)
        .is("deleted_at", null),
      loadHistoricalDailyAvg(admin, input.locationId),
      Promise.resolve(startOfLocalDayIso(timezone, now)),
    ]);

  const trackedIds = ((productRows ?? []) as ProductStockRow[]).map((row) => row.id);
  const todayOrderCounts = new Map<string, number>();

  if (trackedIds.length > 0) {
    const { data: todayOrders } = await admin
      .from("orders")
      .select("id")
      .eq("location_id", input.locationId)
      .gte("created_at", todayStart)
      .not("status", "in", '("cancelled","rejected")');

    const orderIds = (todayOrders ?? []).map((row) => (row as { id: string }).id);

    if (orderIds.length > 0) {
      const { data: todayItems } = await admin
        .from("order_items")
        .select("product_id, quantity")
        .in("order_id", orderIds)
        .in("product_id", trackedIds);

      for (const row of (todayItems ?? []) as Array<{
        product_id: string;
        quantity: number;
      }>) {
        todayOrderCounts.set(
          row.product_id,
          (todayOrderCounts.get(row.product_id) ?? 0) + row.quantity
        );
      }
    }
  }

  const products = ((productRows ?? []) as ProductStockRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    currentStock: row.track_stock ? row.stock_quantity : null,
  }));

  const { levels, alerts } = evaluateInventory({
    products,
    todayOrderCounts,
    historicalDailyAvg,
    currentHour: localHourInTimezone(timezone, now),
    closingHour,
  });

  const stockOutIds = autoUnavailableProductIds(levels);
  const manualOutIds = ((productRows ?? []) as ProductStockRow[])
    .filter((row) => !row.is_available)
    .map((row) => row.id);

  return {
    levels,
    alerts,
    autoUnavailableProductIds: [...new Set([...stockOutIds, ...manualOutIds])],
  };
}

export function mergeUnavailableProductIds(
  manualUnavailableIds: string[],
  inventory: Pick<VenueInventorySnapshot, "autoUnavailableProductIds">
): string[] {
  return [...new Set([...manualUnavailableIds, ...inventory.autoUnavailableProductIds])];
}
