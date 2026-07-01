import type { SupabaseClient } from "@supabase/supabase-js";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { roundMoney } from "@/lib/tax/vat";
import { computeOrgQualityScore } from "@/lib/platform/denis-eval-dashboard";

export type CrossLocationMenuItemRow = {
  productName: string;
  locationId: string;
  locationName: string;
  quantitySold: number;
  revenue: number;
};

export type CrossLocationStaffRow = {
  staffId: string;
  staffName: string;
  locationId: string;
  locationName: string;
  ordersHandled: number;
  revenue: number;
};

export type CrossLocationQualityRow = {
  locationId: string;
  locationName: string;
  qualityScore: number;
  experienceScore: number | null;
  conversionRate: number;
};

export type CrossLocationAnalytics = {
  topMenuItems: CrossLocationMenuItemRow[];
  staffPerformance: CrossLocationStaffRow[];
  qualityByLocation: CrossLocationQualityRow[];
};

function periodStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function periodStartDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function fetchCrossLocationAnalytics(
  admin: SupabaseClient,
  orgId: string,
  periodDays = 30
): Promise<CrossLocationAnalytics> {
  const fromIso = periodStart(periodDays);
  const fromDate = periodStartDate(periodDays);

  const { data: locationRows } = await admin
    .from("locations")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const locations = (locationRows ?? []) as Array<{ id: string; name: string }>;
  const locationIds = locations.map((l) => l.id);
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  if (!locationIds.length) {
    return { topMenuItems: [], staffPerformance: [], qualityByLocation: [] };
  }

  const [{ data: orderRows }, { data: experienceRows }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, location_id, total, status, created_by_staff_id, order_items(product_name, quantity, total)"
      )
      .in("location_id", locationIds)
      .gte("created_at", fromIso),
    admin
      .from("experience_analytics_daily")
      .select(
        "location_id, sessions_closed, converted_sessions, experience_score"
      )
      .eq("org_id", orgId)
      .gte("metric_date", fromDate),
  ]);

  const menuMap = new Map<string, CrossLocationMenuItemRow>();
  const staffMap = new Map<string, CrossLocationStaffRow>();
  const staffNames = new Map<string, string>();

  for (const raw of orderRows ?? []) {
    const order = raw as {
      id: string;
      location_id: string;
      total: number;
      status: string;
      created_by_staff_id: string | null;
      order_items: Array<{
        product_name: string;
        quantity: number;
        total: number;
      }>;
    };

    if (!countsTowardRevenue(order.status)) continue;

    const locName = locationNameById.get(order.location_id) ?? order.location_id;

    for (const item of order.order_items ?? []) {
      const key = `${order.location_id}:${item.product_name}`;
      const existing = menuMap.get(key) ?? {
        productName: item.product_name,
        locationId: order.location_id,
        locationName: locName,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += Number(item.quantity);
      existing.revenue = roundMoney(existing.revenue + Number(item.total));
      menuMap.set(key, existing);
    }

    if (order.created_by_staff_id) {
      const staffKey = `${order.created_by_staff_id}:${order.location_id}`;
      const existing = staffMap.get(staffKey) ?? {
        staffId: order.created_by_staff_id,
        staffName: staffNames.get(order.created_by_staff_id) ?? "Staff",
        locationId: order.location_id,
        locationName: locName,
        ordersHandled: 0,
        revenue: 0,
      };
      existing.ordersHandled += 1;
      existing.revenue = roundMoney(existing.revenue + Number(order.total));
      staffMap.set(staffKey, existing);
    }
  }

  const staffIds = [...new Set([...staffMap.values()].map((r) => r.staffId))];
  if (staffIds.length) {
    const { data: staffRows } = await admin
      .from("staff")
      .select("id, name, email")
      .in("id", staffIds);

    for (const row of staffRows ?? []) {
      const s = row as { id: string; name: string; email: string | null };
      staffNames.set(s.id, s.name?.trim() || s.email?.trim() || s.id);
    }

    for (const entry of staffMap.values()) {
      entry.staffName = staffNames.get(entry.staffId) ?? entry.staffName;
    }
  }

  type ExpAgg = {
    sessions: number;
    converted: number;
    scoreSum: number;
    scoreCount: number;
  };
  const expByLocation = new Map<string, ExpAgg>();
  for (const id of locationIds) {
    expByLocation.set(id, { sessions: 0, converted: 0, scoreSum: 0, scoreCount: 0 });
  }

  for (const row of experienceRows ?? []) {
    const exp = row as {
      location_id: string;
      sessions_closed: number;
      converted_sessions: number;
      experience_score: number | null;
    };
    const bucket = expByLocation.get(exp.location_id);
    if (!bucket) continue;
    bucket.sessions += Number(exp.sessions_closed);
    bucket.converted += Number(exp.converted_sessions);
    if (exp.experience_score != null) {
      bucket.scoreSum += Number(exp.experience_score);
      bucket.scoreCount += 1;
    }
  }

  const qualityByLocation: CrossLocationQualityRow[] = locations.map((loc) => {
    const exp = expByLocation.get(loc.id)!;
    const conversionRate =
      exp.sessions > 0 ? exp.converted / exp.sessions : 0;
    const avgExperience =
      exp.scoreCount > 0 ? exp.scoreSum / exp.scoreCount : null;

    return {
      locationId: loc.id,
      locationName: loc.name,
      conversionRate,
      experienceScore: avgExperience,
      qualityScore: computeOrgQualityScore({
        conversionRate,
        experienceScore: avgExperience,
        lowBalance: false,
      }),
    };
  });

  qualityByLocation.sort((a, b) => b.qualityScore - a.qualityScore);

  const topMenuItems = [...menuMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const staffPerformance = [...staffMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  return { topMenuItems, staffPerformance, qualityByLocation };
}

/** Best-performing location for a normalized product name. */
export function bestLocationForMenuItem(
  rows: CrossLocationMenuItemRow[],
  productName: string
): CrossLocationMenuItemRow | null {
  const normalized = productName.trim().toLowerCase();
  const matches = rows.filter(
    (row) => row.productName.trim().toLowerCase() === normalized
  );
  if (!matches.length) return null;
  return matches.sort((a, b) => b.revenue - a.revenue)[0] ?? null;
}
