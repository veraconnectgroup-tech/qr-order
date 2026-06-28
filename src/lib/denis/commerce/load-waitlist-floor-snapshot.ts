import type { SupabaseClient } from "@supabase/supabase-js";
import type { WaitlistFloorSnapshot } from "@/lib/denis/commerce/waitlist";
import { DEFAULT_WAITLIST_CONFIG } from "@/lib/denis/commerce/waitlist";

/** Floor occupancy + settling tables for smart wait estimation. */
export async function loadWaitlistFloorSnapshot(
  admin: SupabaseClient,
  locationId: string,
  avgTurnoverMinutes = DEFAULT_WAITLIST_CONFIG.avgTurnoverMinutes
): Promise<WaitlistFloorSnapshot> {
  const { count: activeTables } = await admin
    .from("tables")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .eq("is_active", true);

  const tables = Math.max(1, activeTables ?? 1);

  const { data: openSessions } = await admin
    .from("table_sessions")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "active");

  const sessionIds = (openSessions ?? []).map((row) => row.id);
  const occupied = sessionIds.length;

  let imminentFreeTables = 0;
  if (sessionIds.length > 0) {
    const { data: commerceStates } = await admin
      .from("guest_session_commerce_state" as never)
      .select("session_id, bill_settled")
      .in("session_id", sessionIds);

    imminentFreeTables =
      (commerceStates as Array<{ bill_settled?: boolean }> | null)?.filter(
        (row) => Boolean(row.bill_settled)
      ).length ?? 0;
  }

  return {
    activeTables: tables,
    avgTurnoverMinutes,
    currentOccupancy: Math.min(1, occupied / tables),
    imminentFreeTables,
    wrappingTables: Math.max(0, occupied - imminentFreeTables),
  };
}
