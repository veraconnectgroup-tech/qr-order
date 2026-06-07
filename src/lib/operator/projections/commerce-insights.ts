import { format } from "date-fns";
import {
  computeAvgCheckCents,
  computeConversionRate,
  decimalToCents,
} from "@/lib/operator/projections/helpers";
import { normalizeOperatorPaymentMethod } from "@/lib/operator/fiscal-payment";
import {
  parseOperatorPeriod,
  periodToIsoRange,
} from "@/lib/operator/parse-period";
import { verifyOperatorLocation } from "@/lib/operator/verify-location";
import type {
  OperatorCommerceInsights,
  OperatorPeriod,
  OperatorTaxBreakdownLine,
} from "@/lib/operator/types";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { groupGrossByRate } from "@/lib/tax/vat";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseIncludeFlags(include: string | null | undefined) {
  const parts = new Set(
    (include ?? "menu,daily,payments,tax")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );

  return {
    menu: parts.has("menu"),
    daily: parts.has("daily"),
    payments: parts.has("payments"),
    tax: parts.has("tax"),
    conversion: parts.has("conversion") || parts.has("daily"),
    anticipation: parts.has("anticipation") || parts.has("conversion"),
  };
}

type OrderRow = {
  id: string;
  status: string;
  total: number | string;
  payment_method: string;
  created_at: string;
  session_id: string | null;
};

type ItemRow = {
  order_id: string;
  product_name: string;
  quantity: number;
  total: number | string;
  tax_rate: number;
};

export async function projectCommerceInsights(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    period?: OperatorPeriod | string | null;
    include?: string | null;
  }
): Promise<OperatorCommerceInsights | null> {
  const location = await verifyOperatorLocation(
    admin,
    input.orgId,
    input.locationId
  );
  if (!location) return null;

  const bounds = parseOperatorPeriod(input.period ?? "today");
  const range = periodToIsoRange(bounds);
  const flags = parseIncludeFlags(input.include);

  const { data: orderRows, error: ordersError } = await admin
    .from("orders")
    .select("id, status, total, payment_method, created_at, session_id")
    .eq("location_id", input.locationId)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .neq("status", "cancelled");

  if (ordersError) return null;

  const orders = (orderRows ?? []) as OrderRow[];
  const revenueOrders = orders.filter((row) => countsTowardRevenue(row.status));
  const revenueCents = revenueOrders.reduce(
    (sum, row) => sum + decimalToCents(row.total),
    0
  );

  const paymentSummary = {
    cashCents: 0,
    cardCents: 0,
    onlineCents: 0,
    otherCents: 0,
  };

  if (flags.payments) {
    for (const order of revenueOrders) {
      const cents = decimalToCents(order.total);
      const bucket = normalizeOperatorPaymentMethod(order.payment_method);
      if (bucket === "cash") paymentSummary.cashCents += cents;
      else if (bucket === "card") paymentSummary.cardCents += cents;
      else if (bucket === "online") paymentSummary.onlineCents += cents;
      else paymentSummary.otherCents += cents;
    }
  }

  let menu: OperatorCommerceInsights["menu"] = undefined;
  let taxSummary: OperatorCommerceInsights["taxSummary"] = undefined;
  let daily: OperatorCommerceInsights["daily"] = undefined;
  let conversion: OperatorCommerceInsights["conversion"] = undefined;
  let anticipation: OperatorCommerceInsights["anticipation"] = undefined;

  const revenueOrderIds = revenueOrders.map((row) => row.id);
  let items: ItemRow[] = [];

  if (
    revenueOrderIds.length &&
    (flags.menu || flags.tax || flags.daily)
  ) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("order_id, product_name, quantity, total, tax_rate")
      .in("order_id", revenueOrderIds);

    items = (itemRows ?? []) as ItemRow[];
  }

  if (flags.menu && items.length) {
    const byProduct = new Map<
      string,
      { quantity: number; revenueCents: number }
    >();

    for (const item of items) {
      const name = item.product_name.trim();
      if (!name) continue;
      const current = byProduct.get(name) ?? { quantity: 0, revenueCents: 0 };
      current.quantity += item.quantity;
      current.revenueCents += decimalToCents(item.total);
      byProduct.set(name, current);
    }

    menu = [...byProduct.entries()]
      .map(([productName, stats]) => ({
        productName,
        quantity: stats.quantity,
        revenueCents: stats.revenueCents,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 50);
  }

  if (flags.tax && items.length) {
    const breakdown: OperatorTaxBreakdownLine[] = groupGrossByRate(
      items.map((item) => ({
        gross: Number(item.total),
        taxRate: Number(item.tax_rate ?? 19),
      }))
    ).map((row) => ({
      rate: row.rate,
      netCents: decimalToCents(row.net),
      taxCents: decimalToCents(row.tax),
      grossCents: decimalToCents(row.gross),
    }));

    taxSummary = {
      breakdown,
      mwst19: breakdown.find((row) => row.rate === 19) ?? null,
      mwst7: breakdown.find((row) => row.rate === 7) ?? null,
    };
  }

  if (flags.daily) {
    const byDay = new Map<
      string,
      { ordersCount: number; revenueCents: number }
    >();

    for (const order of revenueOrders) {
      const day = format(new Date(order.created_at), "yyyy-MM-dd");
      const current = byDay.get(day) ?? { ordersCount: 0, revenueCents: 0 };
      current.ordersCount += 1;
      current.revenueCents += decimalToCents(order.total);
      byDay.set(day, current);
    }

    daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        ordersCount: stats.ordersCount,
        revenueCents: stats.revenueCents,
        avgCheckCents: computeAvgCheckCents(
          stats.revenueCents,
          stats.ordersCount
        ),
      }));
  }

  if (flags.conversion) {
    const { data: sessions } = await admin
      .from("table_sessions")
      .select("id")
      .eq("location_id", input.locationId)
      .gte("opened_at", range.from)
      .lte("opened_at", range.to);

    const sessionIdsWithOrder = new Set(
      revenueOrders
        .map((row) => row.session_id)
        .filter((id): id is string => Boolean(id))
    );

    const sessionsCount = (sessions ?? []).length;
    const sessionsWithOrder = (sessions ?? []).filter((row) =>
      sessionIdsWithOrder.has((row as { id: string }).id)
    ).length;

    conversion = {
      sessionsCount,
      sessionsWithOrder,
      conversionRate: computeConversionRate(sessionsCount, sessionsWithOrder),
    };
  }

  if (flags.anticipation) {
    const { data: rollupRows } = await admin
      .from("experience_analytics_daily" as never)
      .select(
        "metric_date, nudge_impressions, offer_conversions, conversion_lag_seconds, by_nudge_kind, by_offer_resolution"
      )
      .eq("location_id", input.locationId)
      .gte("metric_date", range.from.slice(0, 10))
      .lte("metric_date", range.to.slice(0, 10))
      .order("metric_date", { ascending: true });

    const rows = (rollupRows ?? []) as Array<{
      metric_date: string;
      nudge_impressions: number;
      offer_conversions: number;
      conversion_lag_seconds: number;
      by_nudge_kind: Record<string, number>;
      by_offer_resolution: Record<string, number>;
    }>;

    const nudgeImpressions = rows.reduce(
      (sum, row) => sum + (row.nudge_impressions ?? 0),
      0
    );
    const offerConversions = rows.reduce(
      (sum, row) => sum + (row.offer_conversions ?? 0),
      0
    );
    const conversionLagSeconds = rows.reduce(
      (sum, row) => sum + (row.conversion_lag_seconds ?? 0),
      0
    );

    const byNudgeKind: Record<string, number> = {};
    const byOfferResolution: Record<string, number> = {};

    for (const row of rows) {
      for (const [key, value] of Object.entries(row.by_nudge_kind ?? {})) {
        byNudgeKind[key] = (byNudgeKind[key] ?? 0) + value;
      }
      for (const [key, value] of Object.entries(row.by_offer_resolution ?? {})) {
        byOfferResolution[key] = (byOfferResolution[key] ?? 0) + value;
      }
    }

    anticipation = {
      nudgeImpressions,
      offerConversions,
      conversionRate: computeConversionRate(nudgeImpressions, offerConversions),
      avgLagSeconds:
        offerConversions > 0
          ? Math.round(conversionLagSeconds / offerConversions)
          : 0,
      byNudgeKind,
      byOfferResolution,
      daily: rows.map((row) => ({
        date: row.metric_date,
        nudgeImpressions: row.nudge_impressions ?? 0,
        offerConversions: row.offer_conversions ?? 0,
      })),
    };
  }

  const timestamps = revenueOrders.map((row) => row.created_at).sort();

  return {
    locationId: input.locationId,
    locationName: location.name,
    period: range,
    summary: {
      ordersCount: revenueOrders.length,
      revenueCents,
      avgCheckCents: computeAvgCheckCents(
        revenueCents,
        revenueOrders.length
      ),
      firstOrderAt: timestamps[0] ?? null,
      lastOrderAt: timestamps[timestamps.length - 1] ?? null,
    },
    paymentSummary: flags.payments ? paymentSummary : undefined,
    taxSummary,
    menu,
    daily,
    conversion,
    anticipation,
  };
}
