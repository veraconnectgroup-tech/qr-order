import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import {
  localSlotFromDate,
  resolveRhythmPriors,
  rhythmSlotKey,
  slotConfidence,
} from "@/lib/denis/config/resolve-rhythm-priors";
import { isRhythmActive } from "@/lib/denis/config/resolve-rhythm-mode";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RhythmPrepProduct = {
  name: string;
  count: number;
};

/** Staff prep top products for current slot — rhythm priors with legacy fallback. */
export async function loadRhythmPrepTopProducts(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeConfig;
    timezone: string | null;
    weekday: number;
    now?: Date;
  }
): Promise<RhythmPrepProduct[]> {
  if (isRhythmActive(input.config)) {
    const row = await loadLocationRhythmPriors(admin, input.locationId);
    if (row) {
      const now = input.now ?? new Date();
      const { dow, hour } = localSlotFromDate(now, input.timezone ?? row.timezone);
      const slotKey = rhythmSlotKey(dow, hour);
      const slot = row.priors.slots[slotKey];
      const confidence = slot
        ? slotConfidence(slot.sampleSessions, input.config.rhythm.minSampleSessions)
        : 0;

      if (
        slot &&
        confidence >= input.config.rhythm.minConfidence &&
        slot.topProducts.length > 0
      ) {
        return slot.topProducts.map((product) => ({
          name: product.name,
          count: product.count,
        }));
      }
    }
  }

  return loadLegacyTopItemsForWeekday(admin, input.locationId, input.weekday);
}

async function loadLegacyTopItemsForWeekday(
  admin: SupabaseClient,
  locationId: string,
  weekday: number
): Promise<RhythmPrepProduct[]> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `
      created_at,
      order_items (product_name)
    `
    )
    .eq("location_id", locationId)
    .gte("created_at", since)
    .limit(500);

  if (error || !orders?.length) return [];

  const counts = new Map<string, number>();

  for (const order of orders as Array<{
    created_at: string;
    order_items: Array<{ product_name: string }> | null;
  }>) {
    const orderWeekday = new Date(order.created_at).getUTCDay();
    if (orderWeekday !== weekday) continue;

    for (const item of order.order_items ?? []) {
      const name = item.product_name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/** Resolve rhythm for runtime boundaries (scheduler, proactive tick). */
export async function loadRhythmRuntimeContext(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeConfig;
    now?: Date;
  }
) {
  if (!isRhythmActive(input.config)) {
    return resolveRhythmPriors({
      config: input.config,
      priors: null,
      now: input.now,
    });
  }

  const row = await loadLocationRhythmPriors(admin, input.locationId);
  return resolveRhythmPriors({
    config: input.config,
    priors: row?.priors ?? null,
    now: input.now,
    timezone: row?.timezone,
  });
}
