import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOrgQualityScore } from "@/lib/platform/denis-eval-dashboard";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { roundMoney } from "@/lib/tax/vat";

export type OrgHubLocationRow = {
  locationId: string;
  locationName: string;
  city: string | null;
  isActive: boolean;
  revenue30d: number;
  orderCount30d: number;
  staffCount: number;
  denisQualityScore: number | null;
  denisConversionRate: number;
  experienceScore: number | null;
};

export type OrgHubComparison = {
  leftLocationId: string;
  rightLocationId: string;
  leftName: string;
  rightName: string;
  revenueDelta: number;
  conversionDelta: number;
  qualityDelta: number | null;
};

export type OrgHubData = {
  orgName: string;
  currency: string;
  periodDays: number;
  locations: OrgHubLocationRow[];
  totals: {
    revenue: number;
    orders: number;
    staff: number;
    avgQualityScore: number | null;
  };
  comparison: OrgHubComparison | null;
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

export async function fetchOrgHub(
  admin: SupabaseClient,
  orgId: string,
  options?: { periodDays?: number; compareLocationIds?: [string, string] }
): Promise<OrgHubData> {
  const periodDays = options?.periodDays ?? 30;
  const fromIso = periodStart(periodDays);
  const fromDate = periodStartDate(periodDays);

  const [{ data: org }, { data: locationRows }] = await Promise.all([
    admin.from("organizations").select("name, currency").eq("id", orgId).single(),
    admin
      .from("locations")
      .select("id, name, city, is_active")
      .eq("org_id", orgId)
      .order("name"),
  ]);

  const orgRow = org as { name: string; currency: string } | null;
  const locations = (locationRows ?? []) as Array<{
    id: string;
    name: string;
    city: string | null;
    is_active: boolean;
  }>;

  if (!locations.length) {
    return {
      orgName: orgRow?.name ?? "Organization",
      currency: orgRow?.currency ?? "EUR",
      periodDays,
      locations: [],
      totals: { revenue: 0, orders: 0, staff: 0, avgQualityScore: null },
      comparison: null,
    };
  }

  const locationIds = locations.map((l) => l.id);

  const [
    { data: orders },
    { data: experienceRows },
    { data: staffRows },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("location_id, total, status")
      .in("location_id", locationIds)
      .gte("created_at", fromIso),
    admin
      .from("experience_analytics_daily")
      .select(
        "location_id, sessions_closed, converted_sessions, experience_score, metric_date"
      )
      .eq("org_id", orgId)
      .gte("metric_date", fromDate),
    admin
      .from("staff")
      .select("id, location_id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);

  const revenueByLocation = new Map<string, { revenue: number; orders: number }>();
  for (const id of locationIds) {
    revenueByLocation.set(id, { revenue: 0, orders: 0 });
  }

  for (const row of orders ?? []) {
    const order = row as { location_id: string; total: number; status: string };
    if (!countsTowardRevenue(order.status)) continue;
    const bucket = revenueByLocation.get(order.location_id);
    if (!bucket) continue;
    bucket.revenue += Number(order.total);
    bucket.orders += 1;
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

  const staffByLocation = new Map<string, Set<string>>();
  for (const id of locationIds) {
    staffByLocation.set(id, new Set());
  }

  for (const row of staffRows ?? []) {
    const s = row as { id: string; location_id: string | null };
    if (s.location_id) {
      staffByLocation.get(s.location_id)?.add(s.id);
    }
  }

  const staffIdsForOrg = (staffRows ?? []).map((row) => (row as { id: string }).id);

  let staffLocationRows: Array<{ staff_id: string; location_id: string }> = [];
  if (staffIdsForOrg.length) {
    const { data } = await admin
      .from("staff_locations")
      .select("staff_id, location_id")
      .in("staff_id", staffIdsForOrg);
    staffLocationRows = (data ?? []) as Array<{ staff_id: string; location_id: string }>;
  }

  for (const row of staffLocationRows) {
    staffByLocation.get(row.location_id)?.add(row.staff_id);
  }

  const hubLocations: OrgHubLocationRow[] = locations.map((loc) => {
    const rev = revenueByLocation.get(loc.id)!;
    const exp = expByLocation.get(loc.id)!;
    const conversionRate =
      exp.sessions > 0 ? exp.converted / exp.sessions : 0;
    const avgExperience =
      exp.scoreCount > 0 ? exp.scoreSum / exp.scoreCount : null;

    return {
      locationId: loc.id,
      locationName: loc.name,
      city: loc.city,
      isActive: loc.is_active,
      revenue30d: roundMoney(rev.revenue),
      orderCount30d: rev.orders,
      staffCount: staffByLocation.get(loc.id)?.size ?? 0,
      denisConversionRate: conversionRate,
      experienceScore: avgExperience,
      denisQualityScore:
        exp.sessions > 0 || avgExperience != null
          ? computeOrgQualityScore({
              conversionRate,
              experienceScore: avgExperience,
              lowBalance: false,
            })
          : null,
    };
  });

  hubLocations.sort((a, b) => b.revenue30d - a.revenue30d);

  let totalRevenue = 0;
  let totalOrders = 0;
  const allStaff = new Set<string>();
  let qualitySum = 0;
  let qualityCount = 0;

  for (const loc of hubLocations) {
    totalRevenue += loc.revenue30d;
    totalOrders += loc.orderCount30d;
    if (loc.denisQualityScore != null) {
      qualitySum += loc.denisQualityScore;
      qualityCount += 1;
    }
  }

  for (const row of staffRows ?? []) {
    allStaff.add((row as { id: string }).id);
  }

  let comparison: OrgHubComparison | null = null;
  const compareIds = options?.compareLocationIds;
  if (compareIds) {
    const left = hubLocations.find((l) => l.locationId === compareIds[0]);
    const right = hubLocations.find((l) => l.locationId === compareIds[1]);
    if (left && right) {
      comparison = {
        leftLocationId: left.locationId,
        rightLocationId: right.locationId,
        leftName: left.locationName,
        rightName: right.locationName,
        revenueDelta: roundMoney(left.revenue30d - right.revenue30d),
        conversionDelta: left.denisConversionRate - right.denisConversionRate,
        qualityDelta:
          left.denisQualityScore != null && right.denisQualityScore != null
            ? left.denisQualityScore - right.denisQualityScore
            : null,
      };
    }
  } else if (hubLocations.length >= 2) {
    const left = hubLocations[0]!;
    const right = hubLocations[1]!;
    comparison = {
      leftLocationId: left.locationId,
      rightLocationId: right.locationId,
      leftName: left.locationName,
      rightName: right.locationName,
      revenueDelta: roundMoney(left.revenue30d - right.revenue30d),
      conversionDelta: left.denisConversionRate - right.denisConversionRate,
      qualityDelta:
        left.denisQualityScore != null && right.denisQualityScore != null
          ? left.denisQualityScore - right.denisQualityScore
          : null,
    };
  }

  return {
    orgName: orgRow?.name ?? "Organization",
    currency: orgRow?.currency ?? "EUR",
    periodDays,
    locations: hubLocations,
    totals: {
      revenue: roundMoney(totalRevenue),
      orders: totalOrders,
      staff: allStaff.size,
      avgQualityScore:
        qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null,
    },
    comparison,
  };
}
