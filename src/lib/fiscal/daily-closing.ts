import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  getFiskalyClient,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";

export type VatSummaryEntry = {
  rate: number;
  gross: number;
  net: number;
  tax: number;
};

export type DailyClosingData = {
  orgId: string;
  locationId: string;
  businessDate: string;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  totalCash: number;
  totalNonCash: number;
  totalTips: number;
  vatSummary: VatSummaryEntry[];
  orderCount: number;
  refundCount: number;
  refundTotal: number;
};

const REVENUE_STATUS_LIST = [
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const;

export function isCashPaymentMethod(paymentMethod: string | null): boolean {
  return paymentMethod === "cash" || paymentMethod === "at_bar";
}

export function businessDayUtcBounds(
  businessDate: string,
  timezone: string
): { startIso: string; endIso: string } {
  const start = fromZonedTime(`${businessDate}T00:00:00`, timezone);
  const nextDate = format(
    addDays(parseISO(`${businessDate}T12:00:00`), 1),
    "yyyy-MM-dd"
  );
  const end = fromZonedTime(`${nextDate}T00:00:00`, timezone);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function yesterdayBusinessDate(
  timezone: string,
  now: Date = new Date()
): string {
  const todayInTz = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  return format(addDays(parseISO(`${todayInTz}T12:00:00`), -1), "yyyy-MM-dd");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function groupItemsByVatRate(
  items: Array<{ total: number; tax_rate: number }>
): VatSummaryEntry[] {
  const buckets = new Map<number, number>();

  for (const item of items) {
    const rate = Number(item.tax_rate ?? 19);
    buckets.set(rate, (buckets.get(rate) ?? 0) + Number(item.total));
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, gross]) => {
      const net = gross / (1 + rate / 100);
      return {
        rate,
        gross: roundMoney(gross),
        net: roundMoney(net),
        tax: roundMoney(gross - net),
      };
    });
}

function mapVatRate(taxRate: number): FiskalyVatRate {
  if (taxRate === 7) return "REDUCED_1";
  if (taxRate === 0) return "NULL";
  return "NORMAL";
}

function formatFiskalyAmount(value: number): string {
  return value.toFixed(2);
}

function buildDailyClosingTseSchema(
  closing: {
    total_gross: number;
    total_cash: number;
    total_non_cash: number;
    vat_summary: VatSummaryEntry[];
  },
  currency: string
): FiskalyReceiptSchema {
  const vatRows = (closing.vat_summary ?? []) as VatSummaryEntry[];
  const amounts_per_vat_rate =
    vatRows.length > 0
      ? vatRows.map((row) => ({
          vat_rate: mapVatRate(row.rate),
          amount: formatFiskalyAmount(row.gross),
        }))
      : [
          {
            vat_rate: "NORMAL" as FiskalyVatRate,
            amount: formatFiskalyAmount(Number(closing.total_gross)),
          },
        ];

  const amounts_per_payment_type: FiskalyReceiptSchema["standard_v1"]["receipt"]["amounts_per_payment_type"] =
    [];

  const cash = Number(closing.total_cash);
  const nonCash = Number(closing.total_non_cash);

  if (cash > 0) {
    amounts_per_payment_type.push({
      payment_type: "CASH",
      amount: formatFiskalyAmount(cash),
      currency_code: currency,
    });
  }
  if (nonCash > 0) {
    amounts_per_payment_type.push({
      payment_type: "NON_CASH",
      amount: formatFiskalyAmount(nonCash),
      currency_code: currency,
    });
  }
  if (amounts_per_payment_type.length === 0) {
    amounts_per_payment_type.push({
      payment_type: "NON_CASH",
      amount: formatFiskalyAmount(Number(closing.total_gross)),
      currency_code: currency,
    });
  }

  return {
    standard_v1: {
      receipt: {
        receipt_type: "RECEIPT",
        amounts_per_vat_rate,
        amounts_per_payment_type,
      },
    },
  };
}

export async function computeDailyClosing(
  admin: SupabaseClient,
  orgId: string,
  locationId: string,
  businessDate: string,
  timezone: string
): Promise<DailyClosingData> {
  const { startIso, endIso } = businessDayUtcBounds(businessDate, timezone);

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, status, total, tax_amount, payment_method, tip_amount")
    .eq("location_id", locationId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (ordersError) {
    throw new Error(`Daily closing orders query failed: ${ordersError.message}`);
  }

  const revenueOrders = (orders ?? []).filter((row) =>
    countsTowardRevenue((row as { status: string }).status)
  ) as Array<{
    id: string;
    status: string;
    total: number;
    tax_amount: number;
    payment_method: string;
    tip_amount: number | null;
  }>;

  const orderIds = revenueOrders.map((o) => o.id);
  let orderItems: Array<{ total: number; tax_rate: number }> = [];

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("total, tax_rate")
      .in("order_id", orderIds);

    if (itemsError) {
      throw new Error(`Daily closing items query failed: ${itemsError.message}`);
    }

    orderItems = (items ?? []) as Array<{ total: number; tax_rate: number }>;
  }

  const vatSummary = groupItemsByVatRate(orderItems);
  const totalGross = roundMoney(
    revenueOrders.reduce((sum, o) => sum + Number(o.total), 0)
  );
  const totalTax = roundMoney(
    revenueOrders.reduce((sum, o) => sum + Number(o.tax_amount ?? 0), 0)
  );
  const totalNet = roundMoney(totalGross - totalTax);

  let totalCash = 0;
  let totalNonCash = 0;
  for (const order of revenueOrders) {
    const amount = Number(order.total);
    if (isCashPaymentMethod(order.payment_method)) {
      totalCash += amount;
    } else {
      totalNonCash += amount;
    }
  }
  totalCash = roundMoney(totalCash);
  totalNonCash = roundMoney(totalNonCash);

  const totalTips = roundMoney(
    revenueOrders.reduce((sum, o) => sum + Number(o.tip_amount ?? 0), 0)
  );

  const { data: refunds, error: refundsError } = await admin
    .from("orders")
    .select("id, total, payment_status, refunded_at")
    .eq("location_id", locationId)
    .in("payment_status", ["refunded", "partial_refund"])
    .gte("refunded_at", startIso)
    .lt("refunded_at", endIso);

  if (refundsError) {
    throw new Error(`Daily closing refunds query failed: ${refundsError.message}`);
  }

  const refundRows = (refunds ?? []) as Array<{
    id: string;
    total: number;
    payment_status: string;
    refunded_at: string | null;
  }>;

  const refundTotal = roundMoney(
    refundRows.reduce((sum, o) => sum + Number(o.total), 0)
  );

  return {
    orgId,
    locationId,
    businessDate,
    totalGross,
    totalNet,
    totalTax,
    totalCash,
    totalNonCash,
    totalTips,
    vatSummary,
    orderCount: revenueOrders.length,
    refundCount: refundRows.length,
    refundTotal,
  };
}

export async function saveDailyClosing(
  admin: SupabaseClient,
  data: DailyClosingData,
  closedBy?: string | null
): Promise<{ id: string }> {
  const row = {
    org_id: data.orgId,
    location_id: data.locationId,
    business_date: data.businessDate,
    total_gross: data.totalGross,
    total_net: data.totalNet,
    total_tax: data.totalTax,
    total_cash: data.totalCash,
    total_non_cash: data.totalNonCash,
    total_tips: data.totalTips,
    vat_summary: data.vatSummary as unknown as Json,
    order_count: data.orderCount,
    refund_count: data.refundCount,
    refund_total: data.refundTotal,
    closed_by: closedBy ?? null,
    closed_at: new Date().toISOString(),
  };

  const { data: saved, error } = await admin
    .from("daily_closings" as never)
    .upsert(row as never, { onConflict: "location_id,business_date" })
    .select("id")
    .single();

  if (error || !saved) {
    throw new Error(
      `Daily closing save failed: ${error?.message ?? "unknown error"}`
    );
  }

  return { id: (saved as { id: string }).id };
}

export async function signDailyClosingTse(
  admin: SupabaseClient,
  closingId: string,
  orgId: string
): Promise<void> {
  if (!isFiskalyConfigured()) {
    return;
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("fiskaly_tss_id, fiskaly_client_id, currency")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return;
  }

  const orgRow = org as {
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
    currency: string;
  };

  if (!orgRow.fiskaly_tss_id || !orgRow.fiskaly_client_id) {
    return;
  }

  const { data: closing, error: closingError } = await admin
    .from("daily_closings" as never)
    .select(
      "id, business_date, total_gross, total_cash, total_non_cash, vat_summary, tse_closing_signature"
    )
    .eq("id", closingId)
    .single();

  if (closingError || !closing) {
    throw new Error(
      `Daily closing not found for TSE sign: ${closingError?.message ?? closingId}`
    );
  }

  const closingRow = closing as {
    id: string;
    business_date: string;
    total_gross: number;
    total_cash: number;
    total_non_cash: number;
    vat_summary: VatSummaryEntry[];
    tse_closing_signature: string | null;
  };

  if (closingRow.tse_closing_signature) {
    return;
  }

  const client = getFiskalyClient();
  const schema = buildDailyClosingTseSchema(closingRow, orgRow.currency ?? "EUR");

  const tx = await client.createTransaction(orgRow.fiskaly_tss_id, {
    tx_id: crypto.randomUUID(),
    client_id: orgRow.fiskaly_client_id,
    schema,
    metadata: {
      daily_closing_id: closingId,
      business_date: closingRow.business_date,
      organization_id: orgId,
      closing_type: "z_bon",
    },
  });

  const signature = tx.signature?.value ?? "";
  const counterRaw = tx.signature?.counter ?? tx.number;
  const signatureCounter =
    typeof counterRaw === "number" ? counterRaw : Number(counterRaw);

  const tseData = {
    tss_serial: tx.tss_serial_number ?? "",
    signature_counter: Number.isFinite(signatureCounter)
      ? signatureCounter
      : tx.number,
    signature,
    start_time: tx.time_start,
    end_time: tx.time_end ?? tx.time_start,
    qr_code_data: tx.qr_code_data ?? "",
    tx_id: tx._id,
    tss_id: orgRow.fiskaly_tss_id,
    client_id: orgRow.fiskaly_client_id,
  };

  const { error: updateError } = await admin
    .from("daily_closings" as never)
    .update({
      tse_closing_signature: signature,
      tse_closing_data: tseData as unknown as Json,
    } as never)
    .eq("id", closingId);

  if (updateError) {
    throw new Error(`Daily closing TSE save failed: ${updateError.message}`);
  }

  logger.info("Daily closing TSE signed", {
    closingId,
    orgId,
    businessDate: closingRow.business_date,
    tssSerial: tseData.tss_serial,
  });
}

export async function dailyClosingExists(
  admin: SupabaseClient,
  locationId: string,
  businessDate: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("daily_closings" as never)
    .select("id")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .maybeSingle();

  if (error) {
    throw new Error(`Daily closing lookup failed: ${error.message}`);
  }

  return Boolean(data);
}

/** Standalone locations: active, no connected POS integration. */
export async function listStandaloneLocations(
  admin: SupabaseClient
): Promise<Array<{ id: string; org_id: string; timezone: string }>> {
  const { data: locations, error } = await admin
    .from("locations")
    .select("id, org_id, timezone")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Locations query failed: ${error.message}`);
  }

  const rows = (locations ?? []) as Array<{
    id: string;
    org_id: string;
    timezone: string;
  }>;

  const standalone: Array<{ id: string; org_id: string; timezone: string }> = [];

  for (const location of rows) {
    const { data: pos } = await admin
      .from("pos_integrations" as never)
      .select("id")
      .eq("location_id", location.id)
      .eq("status", "connected")
      .maybeSingle();

    if (pos) continue;

    standalone.push({
      id: location.id,
      org_id: location.org_id,
      timezone: location.timezone || "Europe/Berlin",
    });
  }

  return standalone;
}

export { REVENUE_STATUS_LIST };
