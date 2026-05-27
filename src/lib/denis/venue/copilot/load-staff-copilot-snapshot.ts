import type { SupabaseClient } from "@supabase/supabase-js";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  prioritizeStaffCopilotTables,
  staffCopilotPriorityTables,
} from "@/lib/denis/venue/copilot/prioritize-tables";
import type { StaffCopilotSnapshot } from "@/lib/denis/venue/copilot/types";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import type { KdsStressLevel, VenueOperatingMode } from "@/lib/denis/venue/ops/types";

type LocationRow = {
  ai_concierge_enabled: boolean;
  denis_operating_mode: VenueOperatingMode;
  denis_kds_stress: KdsStressLevel;
};

type TableNameRow = { id: string; name: string };

type HintRow = {
  table_id: string;
  text: string;
  visibility: "denis_only" | "guest_safe";
};

const EMPTY_SNAPSHOT: StaffCopilotSnapshot = {
  enabled: false,
  at: new Date().toISOString(),
  operatingMode: "normal",
  kdsStress: "normal",
  kdsBacklogMinutes: null,
  activeOrderCount: 0,
  floorGraphEnabled: false,
  autoRushEnabled: false,
  autoRushBacklogMinutes: 20,
  canManageOps: false,
  canSetTableHints: false,
  priorityTables: [],
  tables: [],
};

/** Staff-facing Denis copilot snapshot — no guest session leakage (M15). */
export async function loadStaffCopilotSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    staffRole: string;
  }
): Promise<StaffCopilotSnapshot> {
  const [{ data: locationRow }, config] = await Promise.all([
    admin
      .from("locations")
      .select(
        "ai_concierge_enabled, denis_operating_mode, denis_kds_stress"
      )
      .eq("id", input.locationId)
      .maybeSingle(),
    loadConciergeConfigForLocation(input.locationId),
  ]);

  const location = locationRow as LocationRow | null;
  if (!location?.ai_concierge_enabled || !config.enabled) {
    return { ...EMPTY_SNAPSHOT, at: new Date().toISOString() };
  }

  const canManageOps = ["owner", "manager"].includes(input.staffRole);
  const canSetTableHints = ["owner", "manager", "waiter"].includes(
    input.staffRole
  );

  const [{ data: tableRows }, { data: hintRows }, floor] = await Promise.all([
    admin
      .from("tables")
      .select("id, name")
      .eq("location_id", input.locationId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("denis_staff_table_hints" as never)
      .select("table_id, text, visibility")
      .eq("location_id", input.locationId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    loadFloorGraph(admin, input.locationId, {
      backlogThresholdMinutes: config.ops.autoRushBacklogMinutes,
    }),
  ]);

  const tableNames = new Map(
    ((tableRows ?? []) as TableNameRow[]).map((row) => [row.id, row.name])
  );

  const hintsByTable = new Map<string, HintRow>();
  for (const hint of (hintRows ?? []) as HintRow[]) {
    hintsByTable.set(hint.table_id, hint);
  }

  const floorByTable = new Map(
    floor.tables.map((table) => [table.tableId, table])
  );

  const tables = [...tableNames.entries()].map(([tableId, tableName]) => {
    const floorTable = floorByTable.get(tableId);
    const hint = hintsByTable.get(tableId);

    return {
      tableId,
      tableName,
      operatingHint: floorTable?.operatingHint ?? null,
      openOrderCount: floorTable?.openOrderCount ?? 0,
      seatedMinutes: floorTable?.seatedMinutes ?? null,
      hasActiveSession: Boolean(floorTable?.tableSessionId),
      staffHint: hint
        ? { text: hint.text, visibility: hint.visibility }
        : null,
    };
  });

  const sorted = prioritizeStaffCopilotTables(tables);

  return {
    enabled: true,
    at: floor.at,
    operatingMode: location.denis_operating_mode ?? "normal",
    kdsStress: location.denis_kds_stress ?? "normal",
    kdsBacklogMinutes: floor.house.kdsBacklogMinutes,
    activeOrderCount: floor.house.activeOrderCount,
    floorGraphEnabled: config.ops.floorGraphEnabled,
    autoRushEnabled: config.ops.autoRushEnabled,
    autoRushBacklogMinutes: config.ops.autoRushBacklogMinutes,
    canManageOps,
    canSetTableHints,
    priorityTables: staffCopilotPriorityTables(sorted),
    tables: sorted,
  };
}
