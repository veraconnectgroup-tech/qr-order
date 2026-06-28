import { computeKdsBacklogMinutes } from "@/lib/denis/venue/floor/compute-kds-backlog";
import type { KitchenBacklogOrder } from "@/lib/denis/venue/floor/compute-kds-backlog";
import { computeStationQueues } from "@/lib/denis/venue/floor/compute-station-queues";
import { deriveHouseUnderstaffedHint } from "@/lib/denis/venue/floor/derive-table-hint";
import type { FloorGraphHouse } from "@/lib/denis/venue/floor/types";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing"] as const;

/** Build house-level floor snapshot (queues, backlog, staff hint). */
export function composeFloorGraphHouse(input: {
  operatingMode: VenueOperatingMode;
  orders: KitchenBacklogOrder[];
  staffOnFloor: number | null;
  nowMs?: number;
}): FloorGraphHouse {
  const nowMs = input.nowMs ?? Date.now();
  const kdsBacklogMinutes = computeKdsBacklogMinutes(input.orders, nowMs);
  const activeOrderCount = input.orders.filter((order) =>
    (ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status)
  ).length;
  const stationQueues = computeStationQueues(input.orders, nowMs);
  const houseHint = deriveHouseUnderstaffedHint({
    staffOnFloor: input.staffOnFloor,
    activeOrderCount,
  });

  return {
    operatingMode: input.operatingMode,
    kdsBacklogMinutes,
    activeOrderCount,
    staffOnFloor: input.staffOnFloor,
    stationQueues,
    houseHint,
  };
}
