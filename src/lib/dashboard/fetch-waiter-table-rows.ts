import { createClient } from "@/lib/supabase/client";
import {
  buildWaiterTableRows,
  sortWaiterTables,
  startOfTodayIso,
  type WaiterTableRow,
} from "@/lib/dashboard/waiter-table-data";
import type { Table, TableSession, Zone } from "@/types";

export async function fetchWaiterTableRows(
  locationId: string,
  pendingCallTableIds: Set<string> = new Set()
): Promise<WaiterTableRow[]> {
  const supabase = createClient();

  const [{ data: tablesData }, { data: sessions }, { data: orders }] =
    await Promise.all([
      supabase
        .from("tables")
        .select("*, zone:zones(*)")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("table_sessions")
        .select("id, table_id, opened_at")
        .eq("location_id", locationId)
        .eq("status", "active"),
      supabase
        .from("orders")
        .select(
          "id, table_id, session_id, order_number, total, status, created_at, payment_requested_at, payment_status, payment_method"
        )
        .eq("location_id", locationId)
        .gte("created_at", startOfTodayIso())
        .neq("status", "rejected"),
    ]);

  return sortWaiterTables(
    buildWaiterTableRows(
      (tablesData ?? []) as unknown as Array<Table & { zone: Zone | null }>,
      (sessions ?? []) as Array<
        Pick<TableSession, "id" | "table_id" | "opened_at">
      >,
      (orders ?? []) as Array<
        WaiterTableRow["activeOrders"][number] & {
          table_id: string | null;
          session_id: string | null;
        }
      >,
      pendingCallTableIds
    )
  );
}
