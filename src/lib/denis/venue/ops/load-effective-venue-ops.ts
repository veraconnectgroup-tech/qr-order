import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { applyEventModeConfigOverlay } from "@/lib/denis/config/resolve-effective-config";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import {
  loadCachedFloorGraphForLocation,
  resolveEffectiveVenueOps,
} from "@/lib/denis/venue/floor";
import { deriveOpsPlannerEffects } from "@/lib/denis/venue/ops/planner-effects";
import { loadVenueOpsBeliefs } from "@/lib/denis/venue/ops/load-venue-ops";
import type {
  OpsPlannerEffects,
  VenueOpsBeliefs,
} from "@/lib/denis/venue/ops/types";

/** DB ops + optional cached floor graph merge (M14). */
export async function loadEffectiveVenueOps(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    config: ConciergeConfig;
  }
): Promise<{
  venueOps: VenueOpsBeliefs;
  opsEffects: OpsPlannerEffects;
  floor: FloorGraph | null;
  effectiveConfig: ConciergeConfig;
}> {
  const dbOps = await loadVenueOpsBeliefs(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
  });

  const floor = input.config.ops.floorGraphEnabled
    ? await loadCachedFloorGraphForLocation(input.locationId)
    : null;

  const venueOps = resolveEffectiveVenueOps(dbOps, floor, input.config);
  const opsEffects = deriveOpsPlannerEffects(venueOps, input.config);
  const effectiveConfig = applyEventModeConfigOverlay(input.config, venueOps);

  return { venueOps, opsEffects, floor, effectiveConfig };
}
