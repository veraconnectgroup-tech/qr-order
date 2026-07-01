import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveTrajectoryFromFloor,
} from "@/lib/denis/intelligence/table-turnover";
import {
  detectTransferOpportunities,
  type TransferOrder,
  type TransferReservation,
  type TransferSuggestion,
  type TransferTableState,
  type TransferWaitingParty,
} from "@/lib/denis/intelligence/table-transfer-advisor";
import { loadWaitlistEntries } from "@/lib/denis/commerce/waitlist-store";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import type { PartyMode } from "@/lib/denis/venue/party/types";
import type { TableTurnoverPrediction } from "@/lib/denis/intelligence/table-turnover";

type TableMetaRow = {
  id: string;
  name: string;
  seats: number | null;
};

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready"];

function inferWindowSeat(tableName: string): boolean {
  const normalized = tableName.trim().toLowerCase();
  return (
    normalized.includes("prozor") ||
    normalized.includes("window") ||
    normalized.startsWith("w")
  );
}

/** Build transfer advisor input from live floor snapshot (R2). */
export async function buildTransferSuggestionsForCopilot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    floor: FloorGraph;
    tableRows: TableMetaRow[];
    partyMode: PartyMode;
    turnoverPredictions?: TableTurnoverPrediction[];
    reservations?: TransferReservation[];
    nowMs?: number;
  }
): Promise<TransferSuggestion[]> {
  const nowMs = input.nowMs ?? Date.now();
  const floorByTable = new Map(
    input.floor.tables.map((table) => [table.tableId, table])
  );

  const sessionIds = input.floor.tables
    .map((table) => table.tableSessionId)
    .filter((id): id is string => Boolean(id));

  const partyCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: partyRows } = await admin
      .from("denis_party_devices")
      .select("table_session_id")
      .eq("location_id", input.locationId)
      .in("table_session_id", sessionIds);

    for (const row of (partyRows ?? []) as Array<{ table_session_id: string }>) {
      partyCountBySession.set(
        row.table_session_id,
        (partyCountBySession.get(row.table_session_id) ?? 0) + 1
      );
    }
  }

  const { data: orderRows } = await admin
    .from("orders")
    .select("id, table_id, status")
    .eq("location_id", input.locationId)
    .in("status", [...ACTIVE_ORDER_STATUSES, "delivered"]);

  const activeOrders: TransferOrder[] = ((orderRows ?? []) as Array<{
    id: string;
    table_id: string | null;
    status: string;
  }>)
    .filter((row) => row.table_id && ACTIVE_ORDER_STATUSES.includes(row.status))
    .map((row) => ({
      id: row.id,
      tableId: row.table_id!,
    }));

  const ordersByTable = new Map<string, string[]>();
  for (const row of (orderRows ?? []) as Array<{
    table_id: string | null;
    status: string;
  }>) {
    if (!row.table_id) continue;
    const list = ordersByTable.get(row.table_id) ?? [];
    list.push(row.status);
    ordersByTable.set(row.table_id, list);
  }

  const tables: TransferTableState[] = input.tableRows.map((row) => {
    const floorTable = floorByTable.get(row.id);
    const partySize = floorTable?.tableSessionId
      ? partyCountBySession.get(floorTable.tableSessionId) ?? 1
      : 0;
    const statuses = ordersByTable.get(row.id) ?? [];
    const hasDeliveredOrders =
      statuses.length > 0 && statuses.every((status) => status === "delivered");
    const trajectory = deriveTrajectoryFromFloor({
      seatedMinutes: floorTable?.seatedMinutes ?? null,
      openOrderCount: floorTable?.openOrderCount ?? 0,
      allOrdersDelivered: hasDeliveredOrders,
      idleMinutes: null,
      guestWaitMinutes: null,
      minutesSinceLastDelivery: hasDeliveredOrders ? 35 : null,
    });

    return {
      tableId: row.id,
      tableName: row.name,
      seats: Math.max(1, row.seats ?? 2),
      hasActiveSession: Boolean(floorTable?.tableSessionId),
      partySize: Math.max(partySize, floorTable?.tableSessionId ? 1 : 0),
      openOrderCount: floorTable?.openOrderCount ?? 0,
      seatedMinutes: floorTable?.seatedMinutes ?? null,
      isWindowSeat: inferWindowSeat(row.name),
      isPayingPhase: trajectory.meal === "paying",
      guestPace: null,
    };
  });

  const waitlistEntries = await loadWaitlistEntries(input.locationId);
  const waitingParties: TransferWaitingParty[] = waitlistEntries
    .filter((entry) => entry.status === "waiting" || entry.status === "notified")
    .slice(0, 3)
    .map((entry, index) => ({
      tableName: String(index + 7),
      partySize: entry.partySize,
    }));

  return detectTransferOpportunities({
    tables,
    activeOrders,
    reservations: input.reservations ?? [],
    turnoverPredictions: input.turnoverPredictions,
    partyMode: input.partyMode,
    rushMode: input.floor.house.operatingMode === "rush",
    waitingParties,
    now: nowMs,
  });
}

export {
  formatTransferCopilotLine,
  formatTransferSuggestionReason,
  type TransferSuggestion,
} from "@/lib/denis/intelligence/table-transfer-advisor";
