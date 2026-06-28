import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";

type LocationOpsRow = {
  denis_operating_mode: VenueOperatingMode;
  denis_kds_stress: "normal" | "high";
};

/**
 * Persist auto rush when KDS backlog exceeds threshold (M14).
 * Only elevates from `normal` — never demotes manual staff settings.
 */
export async function applyAutoRushFromFloor(
  admin: SupabaseClient,
  locationId: string,
  floor: Pick<FloorGraph, "house" | "tables">,
  config: Pick<ConciergeConfig, "ops">
): Promise<boolean> {
  if (!shouldAutoRushFromFloor(floor, config)) return false;

  const { data: row } = await admin
    .from("locations")
    .select("denis_operating_mode, denis_kds_stress")
    .eq("id", locationId)
    .maybeSingle();

  const current = row as LocationOpsRow | null;
  if (!current || current.denis_operating_mode !== "normal") {
    return false;
  }

  const { error } = await admin
    .from("locations")
    .update({
      denis_operating_mode: "rush",
      denis_kds_stress: "high",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId)
    .eq("denis_operating_mode", "normal");

  return !error;
}
