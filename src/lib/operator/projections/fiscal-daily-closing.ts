import { decimalToCents } from "@/lib/operator/projections/helpers";
import { verifyOperatorLocation } from "@/lib/operator/verify-location";
import type {
  OperatorFiscalDailyClosing,
  OperatorTaxBreakdownLine,
} from "@/lib/operator/types";
import type { VatSummaryEntry } from "@/lib/fiscal/daily-closing";
import type { SupabaseClient } from "@supabase/supabase-js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function mapVatSummary(
  rows: VatSummaryEntry[] | null | undefined
): OperatorTaxBreakdownLine[] {
  return (rows ?? []).map((row) => ({
    rate: Number(row.rate),
    netCents: decimalToCents(row.net),
    taxCents: decimalToCents(row.tax),
    grossCents: decimalToCents(row.gross),
  }));
}

export async function projectFiscalDailyClosing(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    businessDate: string;
  }
): Promise<OperatorFiscalDailyClosing | null> {
  if (!DATE_PATTERN.test(input.businessDate)) return null;

  const location = await verifyOperatorLocation(
    admin,
    input.orgId,
    input.locationId
  );
  if (!location) return null;

  const { data, error } = await admin
    .from("daily_closings" as never)
    .select(
      `
      id,
      business_date,
      z_nr,
      total_gross,
      total_net,
      total_tax,
      total_cash,
      total_non_cash,
      total_tips,
      vat_summary,
      order_count,
      refund_count,
      refund_total,
      tse_closing_signature,
      closed_at
    `
    )
    .eq("location_id", input.locationId)
    .eq("org_id", input.orgId)
    .eq("business_date", input.businessDate)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    business_date: string;
    z_nr: number | null;
    total_gross: number;
    total_net: number;
    total_tax: number;
    total_cash: number;
    total_non_cash: number;
    total_tips: number;
    vat_summary: VatSummaryEntry[] | null;
    order_count: number;
    refund_count: number;
    refund_total: number;
    tse_closing_signature: string | null;
    closed_at: string;
  };

  const taxBreakdown = mapVatSummary(row.vat_summary);

  return {
    closingId: row.id,
    locationId: input.locationId,
    locationName: location.name,
    businessDate: row.business_date,
    zNr: row.z_nr,
    status: row.tse_closing_signature ? "signed" : "closed",
    totals: {
      grossCents: decimalToCents(row.total_gross),
      netCents: decimalToCents(row.total_net),
      taxCents: decimalToCents(row.total_tax),
      cashCents: decimalToCents(row.total_cash),
      nonCashCents: decimalToCents(row.total_non_cash),
      tipsCents: decimalToCents(row.total_tips),
    },
    taxBreakdown,
    taxSummary: {
      breakdown: taxBreakdown,
      mwst19: taxBreakdown.find((line) => line.rate === 19) ?? null,
      mwst7: taxBreakdown.find((line) => line.rate === 7) ?? null,
    },
    paymentSummary: {
      cashCents: decimalToCents(row.total_cash),
      cardCents: decimalToCents(row.total_non_cash),
      onlineCents: 0,
      otherCents: 0,
    },
    orderCount: row.order_count,
    refundCount: row.refund_count,
    refundTotalCents: decimalToCents(row.refund_total),
    tseSigned: Boolean(row.tse_closing_signature),
    closedAt: row.closed_at,
    zBonPath: `/api/fiscal/daily-closing/${row.id}/z-bon`,
  };
}
