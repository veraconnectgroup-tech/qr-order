import { createAdminClient } from "@/lib/supabase/admin";
import { parseDashboardTableStatusRows } from "@/lib/supabase/query-rows";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { buildFloorTableRows } from "@/lib/dashboard/floor-status";
import { computePeakHoursHeatmap } from "@/lib/dashboard/peak-hours";
import { computeStaffPerformance } from "@/lib/dashboard/staff-performance";
import { loadStaffNotifications } from "@/lib/denis/notifications/persist-staff-notification";
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
  locationId: string,
  orgId?: string
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
    { data: floorOrderRows },
    { data: callRows },
    { data: aiSessionRows },
    { data: staffOrderRows },
    { data: staffCallRows },
    { data: staffRows },
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
    admin
      .from("orders")
      .select(
        "id, table_id, session_id, total, status, payment_requested_at, payment_status, payment_method, created_at"
      )
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "cancelled"),
    admin
      .from("waiter_calls")
      .select("table_id")
      .eq("location_id", locationId)
      .eq("status", "pending"),
    admin
      .from("ai_sessions")
      .select("id, table_id")
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("orders")
      .select("created_by_staff_id, total, status, created_at")
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "rejected")
      .neq("status", "cancelled"),
    admin
      .from("waiter_calls")
      .select("acknowledged_at, created_at")
      .eq("location_id", locationId)
      .gte("created_at", todayStart),
    orgId
      ? admin
          .from("staff")
          .select("id, name")
          .eq("org_id", orgId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
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
    if (isPaidPaymentStatus(row.payment_status)) continue;

    const bucket = ordersBySession.get(row.session_id) ?? {
      total: 0,
      hasPaymentRequest: false,
    };
    bucket.total += Number(row.total);
    if (
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

  const allTables = parseDashboardTableStatusRows(tablesRows);

  const waiterCallTableIds = new Set(
    ((callRows ?? []) as Array<{ table_id: string }>).map((row) => row.table_id)
  );
  const aiSessionsByTable = new Map<string, string>();
  for (const row of (aiSessionRows ?? []) as Array<{
    id: string;
    table_id: string;
  }>) {
    aiSessionsByTable.set(row.table_id, row.id);
  }

  const floorTables = buildFloorTableRows({
    tables: allTables,
    sessions: (sessionRows ?? []) as Array<{
      id: string;
      table_id: string;
      opened_at: string;
    }>,
    orders: (floorOrderRows ?? []) as Parameters<
      typeof buildFloorTableRows
    >[0]["orders"],
    waiterCallTableIds,
    aiSessionsByTable,
  });

  const staffNames = new Map<string, string>();
  for (const row of (staffRows ?? []) as Array<{ id: string; name: string }>) {
    staffNames.set(row.id, row.name);
  }

  const peakHours = computePeakHoursHeatmap(
    (staffOrderRows ?? []) as Array<{
      total: number;
      status: string;
      created_at: string;
    }>
  );

  const staffPerformance = computeStaffPerformance({
    orders: (staffOrderRows ?? []) as Array<{
      created_by_staff_id: string | null;
      total: number;
      status: string;
    }>,
    staffNames,
    waiterCalls: (staffCallRows ?? []) as Array<{
      acknowledged_at: string | null;
      created_at: string;
    }>,
  });

  const denisActivity = orgId
    ? await loadStaffNotifications(admin, {
        orgId,
        locationId,
        limit: 12,
      })
    : [];

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
    floorTables,
    peakHours,
    staffPerformance,
    denisActivity,
  };
}
