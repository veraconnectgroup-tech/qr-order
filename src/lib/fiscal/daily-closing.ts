import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FiskalyReceiptSchema,
  type FiskalyVatRate,
  getFiskalyClient,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";
import { formatPrice } from "@/lib/format";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security/escape";
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

export type DailyClosingRow = {
  id: string;
  org_id: string;
  location_id: string;
  business_date: string;
  total_gross: number;
  total_net: number;
  total_tax: number;
  total_cash: number;
  total_non_cash: number;
  total_tips: number;
  vat_summary: VatSummaryEntry[];
  order_count: number;
  refund_count: number;
  refund_total: number;
  tse_closing_signature: string | null;
  tse_closing_data: Json | null;
  closed_at: string;
};

export type ZBonTseData = {
  tss_serial?: string;
  signature_counter?: number;
  signature?: string;
  qr_code_data?: string;
};

export type ZBonDisplayData = {
  orgName: string;
  locationName: string;
  locationAddress: string | null;
  steuernummer?: string | null;
  ustIdNr?: string | null;
  businessDate: string;
  currency: string;
  totalGross: number;
  totalCash: number;
  totalNonCash: number;
  orderCount: number;
  refundCount: number;
  refundTotal: number;
  vatSummary: VatSummaryEntry[];
  tseSignature: string | null;
  tseData: ZBonTseData | null;
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
      .from("pos_integrations")
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

function parseClosingTseData(raw: unknown): ZBonTseData | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    tss_serial: typeof row.tss_serial === "string" ? row.tss_serial : undefined,
    signature_counter:
      typeof row.signature_counter === "number"
        ? row.signature_counter
        : undefined,
    signature: typeof row.signature === "string" ? row.signature : undefined,
    qr_code_data:
      typeof row.qr_code_data === "string" ? row.qr_code_data : undefined,
  };
}

function formatBusinessDateDe(businessDate: string) {
  return format(parseISO(`${businessDate}T12:00:00`), "dd.MM.yyyy");
}

async function buildTseQrDataUrl(qrPayload: string | undefined): Promise<string | null> {
  const data = qrPayload?.trim();
  if (!data) return null;
  try {
    return await QRCode.toDataURL(data, { width: 180, margin: 1 });
  } catch {
    return null;
  }
}

export async function buildZBonHtml(data: ZBonDisplayData): Promise<string> {
  const dateLabel = formatBusinessDateDe(data.businessDate);
  const qrUrl = data.tseData?.qr_code_data
    ? await buildTseQrDataUrl(data.tseData.qr_code_data)
    : null;

  const vatRows = data.vatSummary
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-size:14px">
            MwSt ${escapeHtml(String(row.rate))}%
            <div style="color:#71717a;font-size:12px;margin-top:2px">
              Netto ${formatPrice(row.net, data.currency)}
            </div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #27272a;text-align:right;color:#fafafa;white-space:nowrap;font-size:14px">
            ${formatPrice(row.tax, data.currency)}
          </td>
        </tr>`
    )
    .join("");

  const fiscalIdBlock = data.steuernummer
    ? `<p style="margin:0 0 4px;color:#a1a1aa;font-size:13px">St.-Nr.: ${escapeHtml(data.steuernummer)}</p>`
    : data.ustIdNr
      ? `<p style="margin:0 0 24px;color:#a1a1aa;font-size:13px">USt-IdNr: ${escapeHtml(data.ustIdNr)}</p>`
      : "";

  const tseBlock =
    data.tseSignature && data.tseData
      ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #27272a">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:0.06em">
            TSE-signiert (KassenSichV)
          </p>
          ${
            data.tseData.tss_serial
              ? `<p style="margin:0 0 4px;font-size:12px;color:#a1a1aa">TSE-Seriennummer: ${escapeHtml(data.tseData.tss_serial)}</p>`
              : ""
          }
          ${
            data.tseData.signature_counter != null
              ? `<p style="margin:0 0 4px;font-size:12px;color:#a1a1aa">Signaturzähler: ${escapeHtml(String(data.tseData.signature_counter))}</p>`
              : ""
          }
          <p style="margin:0;font-size:11px;color:#71717a;word-break:break-all">Signatur: ${escapeHtml(data.tseSignature.slice(0, 32))}…</p>
          ${
            qrUrl
              ? `<div style="margin-top:16px;text-align:center">
                  <img src="${qrUrl}" alt="TSE QR-Code" width="180" height="180" style="background:#fff;border-radius:8px;padding:8px" />
                </div>`
              : ""
          }
        </div>`
      : "";

  const stornoRow =
    data.refundCount > 0
      ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:14px;color:#fbbf24">
          <span>Stornos (${data.refundCount})</span>
          <span>${formatPrice(data.refundTotal, data.currency)}</span>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#09090b;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Z-Bon / Tagesabschluss</p>
    <h1 style="margin:0 0 8px;font-size:24px;color:#fafafa">${escapeHtml(data.orgName)}</h1>
    <p style="margin:0 0 4px;color:#a1a1aa;font-size:14px">${escapeHtml(data.locationName)}</p>
    ${
      data.locationAddress
        ? `<p style="margin:0 0 4px;color:#71717a;font-size:13px">${escapeHtml(data.locationAddress)}</p>`
        : ""
    }
    ${fiscalIdBlock}
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:14px">Datum: ${escapeHtml(dateLabel)}</p>

    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr>
            <th style="text-align:left;color:#71717a;font-size:12px;font-weight:600;padding-bottom:8px">MwSt</th>
            <th style="text-align:right;color:#71717a;font-size:12px;font-weight:600;padding-bottom:8px">Betrag</th>
          </tr>
        </thead>
        <tbody>${vatRows || `<tr><td colspan="2" style="color:#71717a;font-size:14px;padding:8px 0">Keine Umsätze</td></tr>`}</tbody>
      </table>

      <div style="border-top:1px solid #27272a;padding-top:16px;font-size:14px;color:#a1a1aa">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Bareinnahmen</span><span>${formatPrice(data.totalCash, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Unbar</span><span>${formatPrice(data.totalNonCash, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:18px;font-weight:700;color:#fafafa">
          <span>Gesamtumsatz (brutto)</span><span>${formatPrice(data.totalGross, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Anzahl Transaktionen</span><span>${escapeHtml(String(data.orderCount))}</span>
        </div>
        ${stornoRow}
      </div>
      ${tseBlock}
    </div>

    <p style="margin:32px 0 0;font-size:12px;color:#52525b;text-align:center">
      Kassenabschluss gemäß KassenSichV · Powered by QR Order
    </p>
  </div>
</body>
</html>`;
}

export async function loadDailyClosingsForLocation(
  admin: SupabaseClient,
  locationId: string,
  orgId: string,
  limit = 30
): Promise<DailyClosingRow[]> {
  const { data, error } = await admin
    .from("daily_closings" as never)
    .select("*")
    .eq("location_id", locationId)
    .eq("org_id", orgId)
    .order("business_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Daily closings query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const closing = row as Record<string, unknown>;
    return {
      ...closing,
      vat_summary: (closing.vat_summary as VatSummaryEntry[]) ?? [],
    } as DailyClosingRow;
  });
}

export async function loadZBonDisplayData(
  admin: SupabaseClient,
  closingId: string,
  orgId: string
): Promise<ZBonDisplayData | null> {
  const { data: closing, error } = await admin
    .from("daily_closings" as never)
    .select("*")
    .eq("id", closingId)
    .eq("org_id", orgId)
    .single();

  if (error || !closing) return null;

  const row = closing as DailyClosingRow;

  const { data: location } = await admin
    .from("locations")
    .select("name, address, city, postal_code")
    .eq("id", row.location_id)
    .single();

  const { data: org } = await admin
    .from("organizations")
    .select("name, currency, steuernummer, ust_id_nr")
    .eq("id", orgId)
    .single();

  if (!location || !org) return null;

  const locationRow = location as {
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  };
  const orgRow = org as {
    name: string;
    currency: string;
    steuernummer: string | null;
    ust_id_nr: string | null;
  };

  const locationAddress = [
    locationRow.address,
    [locationRow.postal_code, locationRow.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    orgName: orgRow.name,
    locationName: locationRow.name,
    locationAddress: locationAddress || null,
    steuernummer: orgRow.steuernummer,
    ustIdNr: orgRow.ust_id_nr,
    businessDate: row.business_date,
    currency: orgRow.currency ?? "EUR",
    totalGross: Number(row.total_gross),
    totalCash: Number(row.total_cash),
    totalNonCash: Number(row.total_non_cash),
    orderCount: row.order_count,
    refundCount: row.refund_count,
    refundTotal: Number(row.refund_total),
    vatSummary: row.vat_summary ?? [],
    tseSignature: row.tse_closing_signature,
    tseData: parseClosingTseData(row.tse_closing_data),
  };
}

export async function runManualDailyClosing(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    businessDate: string;
    timezone: string;
    closedBy?: string | null;
  }
): Promise<{ id: string; data: DailyClosingData }> {
  const data = await computeDailyClosing(
    admin,
    input.orgId,
    input.locationId,
    input.businessDate,
    input.timezone
  );
  const { id } = await saveDailyClosing(admin, data, input.closedBy);
  await signDailyClosingTse(admin, id, input.orgId);
  return { id, data };
}

export { REVENUE_STATUS_LIST };
