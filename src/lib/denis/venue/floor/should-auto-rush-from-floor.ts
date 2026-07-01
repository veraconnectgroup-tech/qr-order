import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { detectRushMode } from "@/lib/denis/intelligence/table-turnover";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";

const UNDERSTAFFED_AUTO_RUSH_ORDER_THRESHOLD = 8;

function floorAvgWaitMinutes(floor: Pick<FloorGraph, "house">): number {
  const kitchen = (floor.house.stationQueues ?? []).find(
    (queue) => queue.station === "kitchen"
  );
  return kitchen?.avgWaitMinutes ?? floor.house.kdsBacklogMinutes ?? 0;
}

function floorActiveTableCount(floor: Pick<FloorGraph, "tables">): number {
  return floor.tables.filter((table) => table.tableSessionId != null).length;
}

/** True when backlog, thin staff, or occupancy+wait warrants auto rush (M14 + M2). */
export function shouldAutoRushFromFloor(
  floor: Pick<FloorGraph, "house" | "tables">,
  config: Pick<ConciergeConfig, "ops">
): boolean {
  if (!config.ops.autoRushEnabled) return false;

  const backlog = floor.house.kdsBacklogMinutes;
  if (
    backlog != null &&
    backlog >= config.ops.autoRushBacklogMinutes
  ) {
    return true;
  }

  const staff = floor.house.staffOnFloor;
  if (
    staff != null &&
    staff <= 1 &&
    floor.house.activeOrderCount > UNDERSTAFFED_AUTO_RUSH_ORDER_THRESHOLD
  ) {
    return true;
  }

  const rush = detectRushMode({
    activeTableCount: floorActiveTableCount(floor),
    totalTables: floor.tables.length,
    avgWaitMinutes: floorAvgWaitMinutes(floor),
    kdsBacklog: floor.house.activeOrderCount,
  });

  return rush.isRush;
}

export function detectRushFromFloor(
  floor: Pick<FloorGraph, "house" | "tables">
): ReturnType<typeof detectRushMode> {
  return detectRushMode({
    activeTableCount: floorActiveTableCount(floor),
    totalTables: floor.tables.length,
    avgWaitMinutes: floorAvgWaitMinutes(floor),
    kdsBacklog: floor.house.activeOrderCount,
  });
}

/** True when auto rush should revert to normal (M2). */
export function shouldAutoNormalFromFloor(
  floor: Pick<FloorGraph, "house" | "tables">,
  config: Pick<ConciergeConfig, "ops">
): boolean {
  if (!config.ops.autoRushEnabled) return false;
  const rush = detectRushFromFloor(floor);
  return rush.suggestNormal;
}
