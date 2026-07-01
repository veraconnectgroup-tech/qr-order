import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { deriveStationStressFromQueues } from "@/lib/denis/venue/floor/derive-station-stress";
import { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

/** Merge floor snapshot into DB ops beliefs for guest planner (M14). */
export function resolveEffectiveVenueOps(
  dbOps: VenueOpsBeliefs,
  floor: Pick<FloorGraph, "house" | "tables"> | null,
  config: Pick<ConciergeConfig, "ops">
): VenueOpsBeliefs {
  if (!config.ops.floorGraphEnabled || !floor) {
    return dbOps;
  }

  const stationStress = floor.house.stationQueues
    ? deriveStationStressFromQueues(
        floor.house.stationQueues,
        config.ops.autoRushBacklogMinutes
      )
    : dbOps.stationStress;

  const merged: VenueOpsBeliefs = {
    ...dbOps,
    stationStress,
    staffOnFloor: floor.house.staffOnFloor ?? dbOps.staffOnFloor,
    houseHint: floor.house.houseHint ?? dbOps.houseHint,
  };

  if (!shouldAutoRushFromFloor(floor, config)) {
    return merged;
  }

  return {
    ...merged,
    operatingMode:
      dbOps.operatingMode === "normal" ? "rush" : dbOps.operatingMode,
    kdsStress: "high",
  };
}
