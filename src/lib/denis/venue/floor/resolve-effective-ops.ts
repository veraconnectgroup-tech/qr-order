import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

/** Merge floor snapshot into DB ops beliefs for guest planner (M14). */
export function resolveEffectiveVenueOps(
  dbOps: VenueOpsBeliefs,
  floor: Pick<FloorGraph, "house"> | null,
  config: Pick<ConciergeConfig, "ops">
): VenueOpsBeliefs {
  if (!config.ops.floorGraphEnabled || !floor) {
    return dbOps;
  }

  const backlog = floor.house.kdsBacklogMinutes;
  if (backlog == null || !config.ops.autoRushEnabled) {
    return dbOps;
  }

  const threshold = config.ops.autoRushBacklogMinutes;
  if (backlog < threshold) {
    return dbOps;
  }

  return {
    ...dbOps,
    operatingMode:
      dbOps.operatingMode === "normal" ? "rush" : dbOps.operatingMode,
    kdsStress: "high",
  };
}
