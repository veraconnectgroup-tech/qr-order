import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { dispatchTransferSuggestions } from "@/lib/denis/notifications/dispatch-transfer-suggestions";
import { buildTransferSuggestionsForCopilot } from "@/lib/denis/venue/copilot/build-transfer-suggestions";
import { applyAutoRushFromFloor } from "@/lib/denis/venue/floor/apply-auto-rush";
import {
  readFloorGraphCache,
  writeFloorGraphCache,
} from "@/lib/denis/venue/floor/floor-cache";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FloorTickResult = {
  scanned: number;
  refreshed: number;
  autoRushApplied: number;
  transferAlerts: number;
  skipped: number;
};

/** Refresh floor snapshots + optional auto rush — cron (M14). */
export async function processDenisFloorTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<FloorTickResult> {
  const limit = options?.limit ?? 50;

  const { data: locationRows, error } = await admin
    .from("locations")
    .select("id")
    .eq("accepting_orders", true)
    .limit(limit);

  if (error) {
    logger.warn("Denis floor tick: location load failed", {
      error: error.message,
    });
    return { scanned: 0, refreshed: 0, autoRushApplied: 0, transferAlerts: 0, skipped: 0 };
  }

  const locations = (locationRows ?? []) as Array<{ id: string }>;
  let refreshed = 0;
  let autoRushApplied = 0;
  let transferAlerts = 0;
  let skipped = 0;

  for (const location of locations) {
    try {
      const config = await loadConciergeConfigForLocation(location.id);
      if (!config.enabled || !config.ops.floorGraphEnabled) {
        skipped++;
        continue;
      }

      const floor = await loadFloorGraph(admin, location.id, {
        backlogThresholdMinutes: config.ops.autoRushBacklogMinutes,
      });
      await writeFloorGraphCache(location.id, floor);
      refreshed++;

      const applied = await applyAutoRushFromFloor(
        admin,
        location.id,
        floor,
        config
      );
      if (applied) autoRushApplied++;

      const { data: tableRows } = await admin
        .from("tables")
        .select("id, name, seats")
        .eq("location_id", location.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      const { data: locationRow } = await admin
        .from("locations")
        .select("org_id")
        .eq("id", location.id)
        .maybeSingle();

      const orgId = (locationRow as { org_id?: string } | null)?.org_id;
      if (orgId && (tableRows ?? []).length > 0) {
        const suggestions = await buildTransferSuggestionsForCopilot(admin, {
          locationId: location.id,
          floor,
          tableRows: (tableRows ?? []) as Array<{
            id: string;
            name: string;
            seats: number | null;
          }>,
          partyMode: config.party.mode,
        });

        if (suggestions.length > 0) {
          transferAlerts += await dispatchTransferSuggestions({
            orgId,
            locationId: location.id,
            suggestions,
          });
        }
      }
    } catch (tickError) {
      logger.warn("Denis floor tick: location failed", {
        locationId: location.id,
        error:
          tickError instanceof Error ? tickError.message : String(tickError),
      });
      skipped++;
    }
  }

  return {
    scanned: locations.length,
    refreshed,
    autoRushApplied,
    transferAlerts,
    skipped,
  };
}

/** Read cached floor or null — safe on hot guest path. */
export async function loadCachedFloorGraphForLocation(
  locationId: string
): Promise<Awaited<ReturnType<typeof readFloorGraphCache>>> {
  return readFloorGraphCache(locationId);
}
