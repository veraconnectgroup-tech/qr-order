import { countsTowardRevenue } from "@/lib/orders/revenue";

export type StaffPerformanceRow = {
  staffId: string;
  staffName: string;
  orderCount: number;
  revenue: number;
  avgResponseSeconds: number | null;
};

export function computeStaffPerformance(input: {
  orders: Array<{
    created_by_staff_id: string | null;
    total: number | string;
    status: string;
  }>;
  staffNames: Map<string, string>;
  waiterCalls: Array<{
    acknowledged_at: string | null;
    created_at: string;
  }>;
}): StaffPerformanceRow[] {
  const byStaff = new Map<
    string,
    { orderCount: number; revenue: number; responseSeconds: number[] }
  >();

  for (const order of input.orders) {
    if (!order.created_by_staff_id) continue;
    if (!countsTowardRevenue(order.status)) continue;

    const bucket = byStaff.get(order.created_by_staff_id) ?? {
      orderCount: 0,
      revenue: 0,
      responseSeconds: [],
    };
    bucket.orderCount += 1;
    bucket.revenue += Number(order.total);
    byStaff.set(order.created_by_staff_id, bucket);
  }

  const responseSamples: number[] = [];
  for (const call of input.waiterCalls) {
    if (!call.acknowledged_at) continue;
    const delta =
      new Date(call.acknowledged_at).getTime() -
      new Date(call.created_at).getTime();
    if (delta >= 0) responseSamples.push(delta / 1000);
  }

  const globalAvgResponse =
    responseSamples.length > 0
      ? responseSamples.reduce((sum, value) => sum + value, 0) /
        responseSamples.length
      : null;

  if (byStaff.size === 0 && globalAvgResponse == null) {
    return [];
  }

  const rows: StaffPerformanceRow[] = Array.from(byStaff.entries()).map(
    ([staffId, stats]) => ({
      staffId,
      staffName: input.staffNames.get(staffId) ?? "Staff",
      orderCount: stats.orderCount,
      revenue: stats.revenue,
      avgResponseSeconds: globalAvgResponse,
    })
  );

  rows.sort((a, b) => b.orderCount - a.orderCount);
  return rows;
}

export function formatResponseSeconds(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}
