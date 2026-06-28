import type { SupabaseClient } from "@supabase/supabase-js";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { roundMoney } from "@/lib/tax/vat";
import { summarizeRevenueShare } from "@/lib/billing/revenue-share";

export type ConsolidatedLocationLine = {
  locationId: string;
  locationName: string;
  orderCount: number;
  grossRevenue: number;
  platformFee: number;
  netToVenue: number;
};

export type ConsolidatedOrgInvoice = {
  orgId: string;
  orgName: string;
  currency: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  locations: ConsolidatedLocationLine[];
  totals: {
    orderCount: number;
    grossRevenue: number;
    platformFee: number;
    netToVenue: number;
  };
  singleInvoice: true;
};

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function buildConsolidatedOrgInvoice(
  admin: SupabaseClient,
  orgId: string
): Promise<ConsolidatedOrgInvoice> {
  const { start, end } = monthBounds();

  const [{ data: org }, { data: locations }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, currency, platform_fee_percent, platform_fee_fixed")
      .eq("id", orgId)
      .single(),
    admin
      .from("locations")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const orgRow = org as {
    name: string;
    currency: string;
    platform_fee_percent: number;
    platform_fee_fixed: number;
  };

  const locRows = (locations ?? []) as Array<{ id: string; name: string }>;
  const locationIds = locRows.map((l) => l.id);

  const lines: ConsolidatedLocationLine[] = [];

  for (const loc of locRows) {
    const { data: orders } = await admin
      .from("orders")
      .select("total, status, payment_status")
      .eq("location_id", loc.id)
      .gte("created_at", start)
      .lte("created_at", end);

    const paidRevenue = (orders ?? []).filter(
      (row) =>
        countsTowardRevenue((row as { status: string }).status) &&
        (row as { payment_status: string }).payment_status === "paid"
    ) as Array<{ total: number }>;

    const grossRevenue = roundMoney(
      paidRevenue.reduce((sum, o) => sum + Number(o.total), 0)
    );

    const share = summarizeRevenueShare(
      paidRevenue,
      orgRow.platform_fee_percent,
      orgRow.platform_fee_fixed
    );

    lines.push({
      locationId: loc.id,
      locationName: loc.name,
      orderCount: paidRevenue.length,
      grossRevenue,
      platformFee: roundMoney(share.platformFeesCollected),
      netToVenue: roundMoney(grossRevenue - share.platformFeesCollected),
    });
  }

  const totals = lines.reduce(
    (acc, line) => ({
      orderCount: acc.orderCount + line.orderCount,
      grossRevenue: roundMoney(acc.grossRevenue + line.grossRevenue),
      platformFee: roundMoney(acc.platformFee + line.platformFee),
      netToVenue: roundMoney(acc.netToVenue + line.netToVenue),
    }),
    { orderCount: 0, grossRevenue: 0, platformFee: 0, netToVenue: 0 }
  );

  const periodLabel = new Date(start).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  return {
    orgId,
    orgName: orgRow.name,
    currency: orgRow.currency,
    periodLabel,
    periodStart: start,
    periodEnd: end,
    locations: lines,
    totals,
    singleInvoice: true,
  };
}

export function consolidatedInvoiceSummary(
  invoice: ConsolidatedOrgInvoice
): string {
  const locCount = invoice.locations.length;
  return `${invoice.orgName} — ${invoice.periodLabel}: ${invoice.totals.grossRevenue.toFixed(2)} ${invoice.currency} across ${locCount} location(s), one consolidated invoice.`;
}
