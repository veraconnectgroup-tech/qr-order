import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import {
  computeRevenueInsight,
  type RevenueInsight,
} from "@/lib/denis/config/revenue-intelligence";
import { isRhythmActive } from "@/lib/denis/config/resolve-rhythm-mode";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ResolvedRhythmContext } from "@/lib/denis/config/rhythm-prior-types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadLocationSeatCount(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const { data } = await admin
    .from("tables")
    .select("seats")
    .eq("location_id", locationId)
    .eq("is_active", true);

  const total = ((data ?? []) as Array<{ seats: number | null }>).reduce(
    (sum, row) => sum + Math.max(0, row.seats ?? 0),
    0
  );

  return Math.max(total, 1);
}

/** Load revPASH insight for current rhythm slot (H2). */
export async function loadRevenueInsight(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeConfig;
    rhythm: ResolvedRhythmContext;
  }
): Promise<RevenueInsight | null> {
  if (!isRhythmActive(input.config) || !input.rhythm.active) {
    return null;
  }

  const slotKey = input.rhythm.slotKey;
  if (!slotKey) return null;

  const [priorsRow, seatCount] = await Promise.all([
    loadLocationRhythmPriors(admin, input.locationId),
    loadLocationSeatCount(admin, input.locationId),
  ]);

  if (!priorsRow?.priors) return null;

  return computeRevenueInsight(priorsRow.priors, slotKey, seatCount, {
    minSampleSessions: input.config.rhythm.minSampleSessions,
    currentSlotStress: input.rhythm.currentSlotStress ?? undefined,
  });
}
