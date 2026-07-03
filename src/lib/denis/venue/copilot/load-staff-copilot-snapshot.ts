import type { SupabaseClient } from "@supabase/supabase-js";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { buildRushModeSuggestion } from "@/lib/denis/venue/copilot/build-staff-table-brief";
import {
  enrichStaffCopilotTableRow,
  loadStaffCopilotTableContexts,
} from "@/lib/denis/venue/copilot/enrich-staff-copilot-rows";
import {
  prioritizeStaffCopilotTables,
  staffCopilotPriorityTables,
} from "@/lib/denis/venue/copilot/prioritize-tables";
import type { StaffCopilotSnapshot } from "@/lib/denis/venue/copilot/types";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import {
  buildEventCopilotLines,
  detectEventGathering,
  formatEventGatheringConfirmHint,
  parseEventConfig,
  resolveEventEffects,
  resolveEventPhase,
} from "@/lib/denis/venue/ops/event-mode";
import { formatInventoryCopilotBrief } from "@/lib/denis/intelligence/inventory-awareness";
import { loadVenueInventorySnapshot } from "@/lib/denis/intelligence/load-venue-inventory";
import { loadLearnedEdgeQueue } from "@/lib/admin/denis-learned-edges";
import {
  formatDiscoveredPairingLine,
  learnedEdgeRowToPairing,
} from "@/lib/denis/intelligence/dynamic-vkg";
import { formatLearnedEdgeLift } from "@/lib/admin/sync-discovered-pairings";
import {
  loadDailyPrepBriefing,
  dailyPrepBriefingToCopilotBlock,
} from "@/lib/denis/venue/copilot/daily-prep-briefing-store";
import { loadDailyPrepBriefingForLocation } from "@/lib/admin/load-daily-prep-briefing-context";
import {
  loadEventCopilotStats,
  loadRecentSessionOpens,
} from "@/lib/denis/venue/ops/load-event-order-stats";
import type { KdsStressLevel, VenueOperatingMode } from "@/lib/denis/venue/ops/types";

type LocationRow = {
  ai_concierge_enabled: boolean;
  denis_operating_mode: VenueOperatingMode;
  denis_kds_stress: KdsStressLevel;
  denis_event_config: unknown;
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
  rushModeSuggestion: null,
  canManageOps: false,
  canSetTableHints: false,
  priorityTables: [],
  tables: [],
  eventBlock: null,
  gatheringHint: null,
  learnedPairingsBlock: null,
  inventoryBrief: null,
  prepBriefingBlock: null,
};

const SNAPSHOT_CACHE_TTL_SECONDS = 8;

function snapshotCacheKey(locationId: string) {
  return `denis:staff-copilot-snapshot:${locationId}`;
}

/**
 * Staff-facing Denis copilot snapshot — no guest session leakage (M15).
 * The underlying analysis (table priorities, floor graph, inventory, event
 * mode) is identical for every staff member at a location, so it's cached
 * for a few seconds behind Redis; only the two role-derived booleans are
 * computed fresh per caller.
 */
export async function loadStaffCopilotSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    staffRole: string;
  }
): Promise<StaffCopilotSnapshot> {
  const canManageOps = ["owner", "manager"].includes(input.staffRole);
  const canSetTableHints = ["owner", "manager", "waiter"].includes(
    input.staffRole
  );

  const redis = getRedisClient();
  const cacheKey = snapshotCacheKey(input.locationId);

  if (redis) {
    try {
      const cached = await redis.get<StaffCopilotSnapshot>(cacheKey);
      if (cached) {
        return { ...cached, canManageOps, canSetTableHints };
      }
    } catch (error) {
      logRedisDegradation(`staff-copilot-snapshot:read:${input.locationId}`, error);
    }
  }

  const body = await computeStaffCopilotSnapshotBody(admin, input.locationId);

  if (redis) {
    try {
      await redis.set(cacheKey, body, { ex: SNAPSHOT_CACHE_TTL_SECONDS });
    } catch (error) {
      logRedisDegradation(`staff-copilot-snapshot:write:${input.locationId}`, error);
      logger.warn("staff copilot snapshot cache write failed", {
        locationId: input.locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ...body, canManageOps, canSetTableHints };
}

/** Role fields are placeholders here — the caller always overwrites them. */
async function computeStaffCopilotSnapshotBody(
  admin: SupabaseClient,
  locationId: string
): Promise<StaffCopilotSnapshot> {
  const [{ data: locationRow }, config, recentOpens, inventorySnapshot] = await Promise.all([
    admin
      .from("locations")
      .select(
        "ai_concierge_enabled, denis_operating_mode, denis_kds_stress, denis_event_config, timezone, org_id"
      )
      .eq("id", locationId)
      .maybeSingle(),
    loadConciergeConfigForLocation(locationId),
    loadRecentSessionOpens(admin, { locationId }),
    loadVenueInventorySnapshot(admin, { locationId }),
  ]);

  const location = locationRow as LocationRow | null;
  if (!location?.ai_concierge_enabled || !config.enabled) {
    return { ...EMPTY_SNAPSHOT, at: new Date().toISOString() };
  }

  const [{ data: tableRows }, { data: hintRows }, floor, pendingLearnedEdges] =
    await Promise.all([
    admin
      .from("tables")
      .select("id, name")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("denis_staff_table_hints" as never)
      .select("table_id, text, visibility")
      .eq("location_id", locationId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    loadFloorGraph(admin, locationId, {
      backlogThresholdMinutes: config.ops.autoRushBacklogMinutes,
    }),
    loadLearnedEdgeQueue(admin, locationId, "pending"),
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

  const tableContexts = await loadStaffCopilotTableContexts(admin, {
    locationId,
    floor,
  });

  const tables = [...tableNames.entries()].map(([tableId, tableName]) => {
    const floorTable = floorByTable.get(tableId);
    const hint = hintsByTable.get(tableId);
    const context = tableContexts.get(tableId);

    return enrichStaffCopilotTableRow(
      {
        tableId,
        tableName,
        operatingHint: floorTable?.operatingHint ?? null,
        openOrderCount: floorTable?.openOrderCount ?? 0,
        seatedMinutes: floorTable?.seatedMinutes ?? null,
        hasActiveSession: Boolean(floorTable?.tableSessionId),
        staffHint: hint
          ? { text: hint.text, visibility: hint.visibility }
          : null,
      },
      context
    );
  });

  const sorted = prioritizeStaffCopilotTables(tables);

  const event = parseEventConfig(location.denis_event_config);
  const operatingMode = location.denis_operating_mode ?? "normal";
  const gathering = detectEventGathering({ recentSessionOpens: recentOpens });
  const gatheringHint =
    gathering.isGathering && operatingMode !== "event"
      ? formatEventGatheringConfirmHint(gathering)
      : null;

  let eventBlock: StaffCopilotSnapshot["eventBlock"] = null;
  if (operatingMode === "event" && event) {
    const eventPhase = resolveEventPhase(event);
    const effects = resolveEventEffects(event, eventPhase);
    const stats = await loadEventCopilotStats(admin, {
      locationId,
      floor,
    });
    eventBlock = {
      title: "Event mode",
      lines: buildEventCopilotLines({ event, effects, stats }),
    };
  }

  const { data: productRows } = await admin
    .from("products")
    .select("id, name")
    .eq("location_id", locationId)
    .is("deleted_at", null);

  const productNames = Object.fromEntries(
    ((productRows ?? []) as Array<{ id: string; name: string }>).map((row) => [
      row.id,
      row.name,
    ])
  );

  const learnedLines =
    pendingLearnedEdges.length > 0
      ? pendingLearnedEdges.slice(0, 5).map((edge) => {
          const pairing = learnedEdgeRowToPairing({
            from_product_id: edge.from_product_id,
            to_product_id: edge.to_product_id,
            impressions: edge.impressions,
            accepts: edge.accepts,
            accept_rate: edge.accept_rate,
            suggested_weight: edge.suggested_weight,
          });
          return `${formatDiscoveredPairingLine(pairing, productNames)} · ${formatLearnedEdgeLift(edge)}`;
        })
      : [];

  const learnedPairingsBlock =
    learnedLines.length > 0
      ? {
          title: "Naučeni parovi (market basket)",
          lines: learnedLines,
        }
      : null;

  const inventoryBriefRaw = formatInventoryCopilotBrief(inventorySnapshot.alerts);
  const inventoryBrief = inventoryBriefRaw.trim() ? inventoryBriefRaw : null;

  let prepBriefingBlock: StaffCopilotSnapshot["prepBriefingBlock"] = null;
  if (location) {
    const timezone = (location as { timezone?: string | null }).timezone ?? null;
    const orgId = (location as { org_id?: string }).org_id;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone?.trim() || "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const storedBriefing = await loadDailyPrepBriefing(locationId, today);
    const briefing =
      storedBriefing ??
      (orgId
        ? await loadDailyPrepBriefingForLocation(admin, {
            locationId,
            orgId,
          })
        : null);
    if (briefing) {
      prepBriefingBlock = dailyPrepBriefingToCopilotBlock(briefing);
    }
  }

  return {
    enabled: true,
    at: floor.at,
    operatingMode,
    kdsStress: location.denis_kds_stress ?? "normal",
    kdsBacklogMinutes: floor.house.kdsBacklogMinutes,
    activeOrderCount: floor.house.activeOrderCount,
    floorGraphEnabled: config.ops.floorGraphEnabled,
    autoRushEnabled: config.ops.autoRushEnabled,
    autoRushBacklogMinutes: config.ops.autoRushBacklogMinutes,
    rushModeSuggestion: buildRushModeSuggestion({
      operatingMode,
      kdsBacklogMinutes: floor.house.kdsBacklogMinutes,
      autoRushEnabled: config.ops.autoRushEnabled,
      autoRushBacklogMinutes: config.ops.autoRushBacklogMinutes,
    }),
    canManageOps: false,
    canSetTableHints: false,
    priorityTables: staffCopilotPriorityTables(sorted),
    tables: sorted,
    eventBlock,
    gatheringHint,
    learnedPairingsBlock,
    inventoryBrief,
    prepBriefingBlock,
  };
}
