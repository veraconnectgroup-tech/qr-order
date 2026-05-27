import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeOverviewDayStats,
  computeSparklinePoints,
  startOfTodayIso,
  startOfYesterdayIso,
  sevenDayRange,
} from "@/lib/dashboard/overview-stats";
import type { DashboardOverviewInitialData } from "@/lib/dashboard/overview-types";

const FEED_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const;

export async function fetchDashboardOverviewInitialData(
  locationId: string
): Promise<DashboardOverviewInitialData> {
  const admin = createAdminClient();
  const todayStart = startOfTodayIso();
  const yesterdayStart = startOfYesterdayIso();
  const { start: weekStart } = sevenDayRange();

  const [
    { data: todayRows },
    { data: yesterdayRows },
    { count: sessionCount },
    { count: tableCount },
    { count: callCount },
    { data: weekRows },
    { data: feedRows },
    { data: sessionRows },
    { data: sessionOrders },
    { data: tablesRows },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("total, status")
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "rejected")
      .neq("status", "cancelled"),
    admin
      .from("orders")
      .select("total, status")
      .eq("location_id", locationId)
      .gte("created_at", yesterdayStart)
      .lt("created_at", todayStart)
      .neq("status", "rejected")
      .neq("status", "cancelled"),
    admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("waiter_calls")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "pending"),
    admin
      .from("orders")
      .select("total, status, created_at")
      .eq("location_id", locationId)
      .gte("created_at", weekStart.toISOString())
      .neq("status", "rejected")
      .neq("status", "cancelled"),
    admin
      .from("orders")
      .select("id, order_number, total, status, created_at, table_id")
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .in("status", [...FEED_STATUSES])
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("table_sessions")
      .select("id, table_id, opened_at")
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("orders")
      .select(
        "session_id, table_id, total, status, payment_requested_at, payment_status, payment_method"
      )
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "rejected"),
    admin
      .from("tables")
      .select("id, name, zone_id, zone:zones(id, name)")
      .eq("location_id", locationId)
      .is("deleted_at", null),
  ]);

  const today = computeOverviewDayStats(
    (todayRows ?? []) as Array<{ total: number; status: string }>
  );
  const yesterday = computeOverviewDayStats(
    (yesterdayRows ?? []) as Array<{ total: number; status: string }>
  );

  const tableNames = new Map(
    ((tablesRows ?? []) as Array<{ id: string; name: string }>).map((t) => [
      t.id,
      t.name,
    ])
  );

  const ordersBySession = new Map<
    string,
    { total: number; hasPaymentRequest: boolean }
  >();

  for (const order of sessionOrders ?? []) {
    const row = order as {
      session_id: string | null;
      total: number;
      payment_requested_at: string | null;
      payment_status: string;
      payment_method: string;
    };
    if (!row.session_id) continue;

    const bucket = ordersBySession.get(row.session_id) ?? {
      total: 0,
      hasPaymentRequest: false,
    };
    bucket.total += Number(row.total);
    if (
      row.payment_status !== "paid" &&
      row.payment_requested_at &&
      row.payment_method !== "unset"
    ) {
      bucket.hasPaymentRequest = true;
    }
    ordersBySession.set(row.session_id, bucket);
  }

  const sessionByTable = new Map<string, { hasPaymentRequest: boolean; sessionTotal: number }>();
  for (const session of (sessionRows ?? []) as Array<{ id: string; table_id: string }>) {
    const stats = ordersBySession.get(session.id);
    if (stats) {
      sessionByTable.set(session.table_id, {
        hasPaymentRequest: stats.hasPaymentRequest,
        sessionTotal: stats.total,
      });
    } else {
      sessionByTable.set(session.table_id, {
        hasPaymentRequest: false,
        sessionTotal: 0,
      });
    }
  }

  const allTables = (tablesRows ?? []) as unknown as Array<{
    id: string;
    name: string;
    zone_id: string | null;
    zone: { id: string; name: string } | null;
  }>;

  return {
    stats: {
      todayRevenue: today.revenue,
      todayOrderCount: today.count,
      todayAvgTicket: today.avg,
      yesterdayRevenue: yesterday.revenue,
      yesterdayOrderCount: yesterday.count,
      yesterdayAvgTicket: yesterday.avg,
      activeSessions: sessionCount ?? 0,
      totalTables: tableCount ?? 0,
      pendingWaiterCalls: callCount ?? 0,
    },
    liveFeed: (
      (feedRows ?? []) as Array<{
        id: string;
        order_number: number;
        total: number;
        status: string;
        created_at: string;
        table_id: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      total: Number(row.total),
      status: row.status,
      created_at: row.created_at,
      table_name: row.table_id ? (tableNames.get(row.table_id) ?? "—") : "—",
    })),
    sparkline: computeSparklinePoints(
      (weekRows ?? []) as Array<{
        total: number;
        status: string;
        created_at: string;
      }>
    ),
    tableStatuses: allTables.map((table) => {
      const session = sessionByTable.get(table.id);
      const base = {
        id: table.id,
        name: table.name,
        zoneId: table.zone_id,
        zoneName: table.zone?.name ?? null,
      };
      if (!session) {
        return { ...base, status: "available" as const };
      }
      return {
        ...base,
        status: session.hasPaymentRequest
          ? ("payment" as const)
          : ("occupied" as const),
        sessionTotal: session.sessionTotal,
      };
    }),
  };
}
