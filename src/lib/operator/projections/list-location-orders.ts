import type { SupabaseClient } from "@supabase/supabase-js";
import { decimalToCents } from "@/lib/operator/projections/helpers";
import {
  parseOperatorPeriod,
  periodToIsoRange,
} from "@/lib/operator/parse-period";
import type { OperatorOrderListItem, OperatorPeriod } from "@/lib/operator/types";

const OPEN_STATUSES = ["pending", "accepted", "preparing", "ready"] as const;

export async function projectLocationOrders(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    period?: OperatorPeriod | string | null;
    status?: string | null;
    limit?: number;
  }
): Promise<OperatorOrderListItem[] | null> {
  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  const limit = Math.min(input.limit ?? 50, 200);
  const bounds = parseOperatorPeriod(input.period ?? "today");
  const range = periodToIsoRange(bounds);

  let query = admin
    .from("orders")
    .select(
      "id, order_number, status, total, created_at, session_id, order_items(id)"
    )
    .eq("location_id", input.locationId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(limit);

  const statusFilter = input.status?.trim();
  if (statusFilter === "open") {
    query = query.in("status", [...OPEN_STATUSES]);
  } else if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.gte("created_at", range.from).lte("created_at", range.to);
  }

  const { data: rows } = await query;
  const orders = (rows ?? []) as Array<{
    id: string;
    order_number: number;
    status: string;
    total: number | string;
    created_at: string;
    session_id: string | null;
    order_items: Array<{ id: string }>;
  }>;

  return orders.map((row) => ({
    orderId: row.id,
    orderNumber: row.order_number,
    status: row.status,
    totalCents: decimalToCents(row.total),
    itemCount: row.order_items?.length ?? 0,
    createdAt: row.created_at,
    sessionId: row.session_id,
  }));
}
