import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { readFloorGraphCache } from "@/lib/denis/venue/floor/floor-cache";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import { deriveStationStressFromQueues } from "@/lib/denis/venue/floor/derive-station-stress";
import { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
import type { FloorGraph, FloorTableHint } from "@/lib/denis/venue/floor/types";
import type { StationStress } from "@/lib/denis/venue/ops/types";

export type DashboardFloorGraphTable = {
  tableId: string;
  tableName: string;
  seatedMinutes: number | null;
  openOrderCount: number;
  operatingHint: FloorTableHint;
  hasActiveSession: boolean;
};

export type DashboardFloorGraphPayload = {
  enabled: boolean;
  at: string;
  floor: FloorGraph | null;
  tables: DashboardFloorGraphTable[];
  stationStress: StationStress[];
  autoRushWouldApply: boolean;
};

const EMPTY: DashboardFloorGraphPayload = {
  enabled: false,
  at: new Date().toISOString(),
  floor: null,
  tables: [],
  stationStress: [],
  autoRushWouldApply: false,
};

/** Staff dashboard floor graph — Redis cache with DB fallback (M14). */
export async function loadDashboardFloorGraph(
  admin: SupabaseClient,
  locationId: string
): Promise<DashboardFloorGraphPayload> {
  const config = await loadConciergeConfigForLocation(locationId);
  if (!config.enabled || !config.ops.floorGraphEnabled) {
    return { ...EMPTY, at: new Date().toISOString() };
  }

  const floor =
    (await readFloorGraphCache(locationId)) ??
    (await loadFloorGraph(admin, locationId, {
      backlogThresholdMinutes: config.ops.autoRushBacklogMinutes,
    }));

  const { data: tableRows } = await admin
    .from("tables")
    .select("id, name")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("name");

  const tableNames = new Map(
    ((tableRows ?? []) as Array<{ id: string; name: string }>).map((row) => [
      row.id,
      row.name,
    ])
  );

  const floorByTable = new Map(
    floor.tables.map((table) => [table.tableId, table])
  );

  const tables: DashboardFloorGraphTable[] = [...tableNames.entries()].map(
    ([tableId, tableName]) => {
      const row = floorByTable.get(tableId);
      return {
        tableId,
        tableName,
        seatedMinutes: row?.seatedMinutes ?? null,
        openOrderCount: row?.openOrderCount ?? 0,
        operatingHint: row?.operatingHint ?? null,
        hasActiveSession: Boolean(row?.tableSessionId),
      };
    }
  );

  const stationStress = floor.house.stationQueues
    ? deriveStationStressFromQueues(
        floor.house.stationQueues,
        config.ops.autoRushBacklogMinutes
      )
    : [];

  return {
    enabled: true,
    at: floor.at,
    floor,
    tables,
    stationStress,
    autoRushWouldApply: shouldAutoRushFromFloor(floor, config),
  };
}
