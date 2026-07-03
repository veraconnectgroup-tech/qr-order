import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateDenisRoiMetrics,
  loadDenisRoiEventsForRange,
  totalDenisAttributedRevenueEuros,
} from "@/lib/billing/denis-roi-tracker";
import { computeBillingRoiJustification } from "@/lib/billing/denis-roi";
import { loadPlanById } from "@/lib/billing/plans";

export type OrgVenueRoiRow = {
  locationId: string;
  locationName: string;
  city: string | null;
  monthlyRevenueEuros: number;
  roiMultiplier: number;
};

export type OrgMultiVenueRoiSummary = {
  currency: string;
  monthLabel: string;
  venues: OrgVenueRoiRow[];
  totals: {
    monthlyRevenueEuros: number;
    avgRoiMultiplier: number;
  };
};

function monthBounds(reference = new Date()): {
  start: string;
  end: string;
  monthLabel: string;
} {
  const startDate = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const endDate = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    monthLabel: startDate.toLocaleDateString("sr-RS", {
      month: "long",
      year: "numeric",
    }),
  };
}

export async function loadOrgMultiVenueRoiSummary(
  admin: SupabaseClient,
  orgId: string,
  options?: { referenceDate?: Date }
): Promise<OrgMultiVenueRoiSummary | null> {
  const [{ data: org }, { data: locationRows }] = await Promise.all([
    admin.from("organizations").select("currency, plan_id").eq("id", orgId).single(),
    admin
      .from("locations")
      .select("id, name, city, is_active")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const locations = (locationRows ?? []) as Array<{
    id: string;
    name: string;
    city: string | null;
    is_active: boolean;
  }>;

  if (locations.length <= 1) return null;

  const orgRow = org as { currency: string; plan_id: string | null } | null;
  const currency = orgRow?.currency ?? "EUR";
  const planId = orgRow?.plan_id ?? "business";
  const plan = await loadPlanById(planId);
  const planCostEuros = (plan?.price_cents ?? 4900) / 100;
  const period = monthBounds(options?.referenceDate);

  const venues = await Promise.all(
    locations.map(async (location) => {
      const eventRows = await loadDenisRoiEventsForRange(admin, {
        locationId: location.id,
        fromIso: period.start,
        toIso: period.end,
      });
      const metrics = aggregateDenisRoiMetrics(eventRows);
      const monthlyRevenueEuros = totalDenisAttributedRevenueEuros(metrics);
      const roi = computeBillingRoiJustification({
        upsellRevenueEuros: monthlyRevenueEuros,
        planCostEuros,
        currency,
      });

      return {
        locationId: location.id,
        locationName: location.name,
        city: location.city,
        monthlyRevenueEuros,
        roiMultiplier:
          roi.roiMultiplier === Infinity ? 99 : roi.roiMultiplier,
      };
    })
  );

  const monthlyRevenueEuros = Math.round(
    venues.reduce((sum, row) => sum + row.monthlyRevenueEuros, 0) * 100
  ) / 100;
  const roiValues = venues
    .map((row) => row.roiMultiplier)
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgRoiMultiplier =
    roiValues.length > 0
      ? Math.round(
          (roiValues.reduce((sum, value) => sum + value, 0) / roiValues.length) *
            10
        ) / 10
      : 0;

  return {
    currency,
    monthLabel: period.monthLabel,
    venues: venues.sort((a, b) => b.monthlyRevenueEuros - a.monthlyRevenueEuros),
    totals: {
      monthlyRevenueEuros,
      avgRoiMultiplier,
    },
  };
}
