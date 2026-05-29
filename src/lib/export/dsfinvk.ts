import JSZip from "jszip";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeCsvField } from "@/lib/security/escape";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { parseDatevDateRange } from "@/lib/export/datev";
import { lineVatBreakdown, roundMoney } from "@/lib/tax/vat";
import packageJson from "../../../package.json";
import { tryLoadJournalDsfinvkContext } from "@/lib/export/dsfinvk-journal-loader";

const BERLIN_TZ = "Europe/Berlin";
const APP_VERSION = packageJson.version;

export type DsfinvkClosingRow = {
  id: string;
  business_date: string;
  z_nr: number | null;
  total_gross: number;
  total_cash: number;
  total_non_cash: number;
  closed_at: string;
  order_count: number;
};

export type DsfinvkOrderRow = {
  id: string;
  order_number: number;
  subtotal: number;
  total: number;
  tax_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  is_takeaway: boolean;
  tse_signature: string | null;
  tse_data: unknown;
  created_by_staff_id: string | null;
  order_source: string;
  is_storno_beleg?: boolean;
  order_items: Array<{
    product_name: string;
    quantity: number;
    total: number;
    tax_rate: number | null;
  }>;
};

export type DsfinvkStornoRecordMeta = {
  originalOrderId: string;
  stornoAmount: number;
  createdAt: string;
  originalCreatedAt: string;
};

export type DsfinvkExportContext = {
  kasseId: string;
  locationName: string;
  locationAddress: string;
  locationCity: string;
  locationPostalCode: string;
  locationTimezone: string;
  currency: string;
  fiskalyClientId: string;
  fiskalyTssId: string;
  closings: DsfinvkClosingRow[];
  closingNumberByDate: Map<string, number>;
  orders: DsfinvkOrderRow[];
  stornoBonOrders: DsfinvkOrderRow[];
  stornoRecords: Map<string, DsfinvkStornoRecordMeta>;
  staffNames: Map<string, string>;
};

export type ParsedTseData = {
  tss_id: string;
  tss_serial: string;
  signature_counter: number | null;
  signature: string;
  start_time: number | null;
  end_time: number | null;
  qr_code_data: string;
  client_id: string;
  public_key: string;
};

export function formatDsfinvkAmount(value: number): string {
  return roundMoney(value).toFixed(2);
}

export { lineVatBreakdown } from "@/lib/tax/vat";

export function mapUstSchluessel(taxRate: number): number {
  if (taxRate === 7) return 2;
  if (taxRate === 0) return 5;
  return 1;
}

export function mapUstSatz(taxRate: number): string {
  if (taxRate === 7) return "7.00";
  if (taxRate === 0) return "0.00";
  return "19.00";
}

export function mapPaymentDsfinvk(paymentMethod: string): {
  typ: string;
  name: string;
  isCash: boolean;
} {
  if (
    paymentMethod === "online" ||
    paymentMethod === "card_at_table" ||
    paymentMethod === "card_terminal" ||
    paymentMethod === "pos_online"
  ) {
    if (paymentMethod === "online") {
      return { typ: "Unbar", name: "Online-Zahlung", isCash: false };
    }
    return { typ: "Unbar", name: "Kartenzahlung", isCash: false };
  }
  return { typ: "Bar", name: "Bargeld", isCash: true };
}

export function parseTseData(raw: unknown): ParsedTseData | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const tssSerial =
    typeof row.tss_serial === "string" ? row.tss_serial.trim() : "";
  if (!tssSerial) return null;

  return {
    tss_id: typeof row.tss_id === "string" ? row.tss_id.trim() : "",
    tss_serial: tssSerial,
    signature_counter:
      typeof row.signature_counter === "number" ? row.signature_counter : null,
    signature:
      typeof row.signature === "string"
        ? row.signature
        : typeof row.qr_code_data === "string"
          ? row.qr_code_data
          : "",
    start_time:
      typeof row.start_time === "number" ? row.start_time : null,
    end_time: typeof row.end_time === "number" ? row.end_time : null,
    qr_code_data:
      typeof row.qr_code_data === "string" ? row.qr_code_data : "",
    client_id: typeof row.client_id === "string" ? row.client_id : "",
    public_key: typeof row.public_key === "string" ? row.public_key : "",
  };
}

export function isStornoOrder(
  order: Pick<DsfinvkOrderRow, "status" | "is_storno_beleg">
): boolean {
  return order.is_storno_beleg === true || order.status === "cancelled";
}

export function allDsfinvkExportOrders(ctx: DsfinvkExportContext): DsfinvkOrderRow[] {
  return [...ctx.orders, ...ctx.stornoBonOrders];
}

export function buildStornoBonOrder(
  record: {
    id: string;
    original_order_id: string;
    storno_amount: number;
    created_at: string;
    tse_storno_signature: string | null;
    tse_storno_data: unknown;
  },
  original: DsfinvkOrderRow
): DsfinvkOrderRow {
  const stornoAmount = Number(record.storno_amount);
  const originalTotal = Number(original.total);
  const ratio = originalTotal > 0 ? stornoAmount / originalTotal : 1;

  return {
    ...original,
    id: record.id,
    subtotal: roundMoney(Number(original.subtotal) * ratio),
    total: stornoAmount,
    tax_amount: roundMoney(Number(original.tax_amount) * ratio),
    created_at: record.created_at,
    accepted_at: record.created_at,
    delivered_at: record.created_at,
    tse_signature: record.tse_storno_signature,
    tse_data: record.tse_storno_data,
    is_storno_beleg: true,
    order_items: original.order_items.map((item) => ({
      ...item,
      total: roundMoney(Number(item.total) * ratio),
    })),
  };
}

export function dsfinvkStornoSign(
  order: Pick<DsfinvkOrderRow, "status" | "is_storno_beleg">
): number {
  return isStornoOrder(order) ? -1 : 1;
}

export function orderBusinessDate(
  createdAt: string,
  timezone: string
): string {
  return formatInTimeZone(new Date(createdAt), timezone, "yyyy-MM-dd");
}

export function berlinTimestamp(iso: string): string {
  return formatInTimeZone(new Date(iso), BERLIN_TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

export function operatorForOrder(
  order: DsfinvkOrderRow,
  staffNames: Map<string, string>
): { id: string; name: string } {
  if (order.created_by_staff_id) {
    return {
      id: order.created_by_staff_id,
      name: staffNames.get(order.created_by_staff_id) ?? "Staff",
    };
  }
  if (order.order_source === "pos") {
    return { id: "POS", name: "POS" };
  }
  return { id: "QR", name: "QR" };
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map((h) => escapeCsvField(h)).join(";");
  const body = rows.map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(";")
  );
  return `\uFEFF${[headerLine, ...body].join("\r\n")}\r\n`;
}

export function buildCashpointClosingCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_ERPISTELLUNG",
    "Z_NR",
    "Z_BUCHUNGSTAG",
    "Z_START_DATUM",
    "Z_END_DATUM",
    "Z_SE_ZAHLUNGEN",
    "Z_SE_BARZAHLUNGEN",
  ];

  const rows = ctx.closings.map((closing) => {
    const zNr = String(ctx.closingNumberByDate.get(closing.business_date) ?? 0);
    const dayOrders = ctx.orders.filter(
      (order) =>
        orderBusinessDate(order.created_at, ctx.locationTimezone) ===
        closing.business_date
    );
    const timestamps = dayOrders.map((order) => order.created_at).sort();
    const start = timestamps[0] ?? `${closing.business_date}T00:00:00.000Z`;
    const end =
      timestamps[timestamps.length - 1] ??
      closing.closed_at ??
      `${closing.business_date}T23:59:59.000Z`;

    return [
      ctx.kasseId,
      berlinTimestamp(closing.closed_at),
      zNr,
      closing.business_date,
      berlinTimestamp(start),
      berlinTimestamp(end),
      formatDsfinvkAmount(Number(closing.total_gross)),
      formatDsfinvkAmount(Number(closing.total_cash)),
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildTransactionsCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "BON_NR",
    "BON_TYP",
    "BON_NAME",
    "TERMINAL_ID",
    "BON_STORNO",
    "BON_START",
    "BON_ENDE",
    "BEDIENER_ID",
    "BEDIENER_NAME",
    "UMS_BRUTTO",
    "UMS_NETTO",
  ];

  const rows = allDsfinvkExportOrders(ctx).map((order) => {
    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");
    const storno = isStornoOrder(order);
    const sign = dsfinvkStornoSign(order);
    const tse = parseTseData(order.tse_data);
    const operator = operatorForOrder(order, ctx.staffNames);
    const bonStart = order.accepted_at ?? order.created_at;
    const bonEnd = order.delivered_at ?? order.created_at;

    return [
      ctx.kasseId,
      zNr,
      order.id,
      String(order.order_number),
      "Beleg",
      storno ? "Stornobeleg" : "Kassenbeleg",
      tse?.client_id || ctx.fiskalyClientId,
      storno ? "1" : "0",
      berlinTimestamp(bonStart),
      berlinTimestamp(bonEnd),
      operator.id,
      operator.name,
      formatDsfinvkAmount(Number(order.total) * sign),
      formatDsfinvkAmount(Number(order.subtotal) * sign),
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildTransactionsTseCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "TSE_ID",
    "TSE_SERIAL",
    "TSE_SIG_COUNTER",
    "TSE_START",
    "TSE_END",
    "TSE_SIG",
    "TSE_HASHALGORITMUS",
    "TSE_PUBLICKEY",
    "TSE_ZEITFORMAT",
    "TSE_PROCESSDATA",
    "TSE_PROCESSTYPE",
  ];

  const rows: string[][] = [];

  for (const order of allDsfinvkExportOrders(ctx)) {
    const tse = parseTseData(order.tse_data);
    if (!tse) continue;

    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");

    rows.push([
      ctx.kasseId,
      zNr,
      order.id,
      tse.tss_id || ctx.fiskalyTssId,
      tse.tss_serial,
      tse.signature_counter != null ? String(tse.signature_counter) : "",
      tse.start_time != null ? String(tse.start_time) : "",
      tse.end_time != null ? String(tse.end_time) : "",
      order.tse_signature ?? tse.signature,
      "SHA-256",
      tse.public_key,
      "unixTime",
      tse.qr_code_data,
      "Kassenbeleg-V1",
    ]);
  }

  return rowsToCsv(headers, rows);
}

export function buildLinesCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "POS_ZEILE",
    "GUTSCHEIN_NR",
    "ARTIKELTEXT",
    "POS_TERMINAL_ID",
    "GV_TYP",
    "GV_NAME",
    "INHAUS",
    "STK",
    "BRUTTO",
    "NETTO",
    "UST",
  ];

  const rows: string[][] = [];

  for (const order of allDsfinvkExportOrders(ctx)) {
    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");
    const sign = dsfinvkStornoSign(order);
    const terminalId = parseTseData(order.tse_data)?.client_id || ctx.fiskalyClientId;
    const inhaus = order.is_takeaway ? "0" : "1";

    order.order_items.forEach((item, index) => {
      const rate = Number(item.tax_rate ?? 19);
      const { gross, net, ust } = lineVatBreakdown(Number(item.total), rate);

      rows.push([
        ctx.kasseId,
        zNr,
        order.id,
        String(index + 1),
        "",
        item.product_name,
        terminalId,
        "Umsatz",
        "Umsatz",
        inhaus,
        String(Number(item.quantity) * sign),
        formatDsfinvkAmount(gross * sign),
        formatDsfinvkAmount(net * sign),
        formatDsfinvkAmount(ust * sign),
      ]);
    });
  }

  return rowsToCsv(headers, rows);
}

export function buildLinesVatCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "POS_ZEILE",
    "UST_SCHLUESSEL",
    "UST_SATZ",
    "UST_BRUTTO",
    "UST_NETTO",
    "UST_UST",
  ];

  const rows: string[][] = [];

  for (const order of allDsfinvkExportOrders(ctx)) {
    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");
    const sign = dsfinvkStornoSign(order);

    order.order_items.forEach((item, index) => {
      const rate = Number(item.tax_rate ?? 19);
      const { gross, net, ust } = lineVatBreakdown(Number(item.total), rate);

      rows.push([
        ctx.kasseId,
        zNr,
        order.id,
        String(index + 1),
        String(mapUstSchluessel(rate)),
        mapUstSatz(rate),
        formatDsfinvkAmount(gross * sign),
        formatDsfinvkAmount(net * sign),
        formatDsfinvkAmount(ust * sign),
      ]);
    });
  }

  return rowsToCsv(headers, rows);
}

export function buildPaymentCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "ZAHLART_TYP",
    "ZAHLART_NAME",
    "ZAHLWAEH_CODE",
    "ZAHLWAEH_BETRAG",
    "BASISWAEH_BETRAG",
  ];

  const rows = allDsfinvkExportOrders(ctx).map((order) => {
    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");
    const payment = mapPaymentDsfinvk(order.payment_method);
    const sign = dsfinvkStornoSign(order);
    const amount = formatDsfinvkAmount(Number(order.total) * sign);

    return [
      ctx.kasseId,
      zNr,
      order.id,
      payment.typ,
      payment.name,
      ctx.currency,
      amount,
      amount,
    ];
  });

  return rowsToCsv(headers, rows);
}

export function buildBusinesscasesCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "POS_ZEILE",
    "GV_TYP",
    "GV_NAME",
    "AGENTUR_ID",
    "UST_SCHLUESSEL",
    "UST_SATZ",
    "BON_BRUTTO",
    "BON_NETTO",
    "BON_UST",
  ];

  const rows: string[][] = [];

  for (const order of allDsfinvkExportOrders(ctx)) {
    const businessDate = orderBusinessDate(
      order.created_at,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(businessDate) ?? "");
    const sign = dsfinvkStornoSign(order);

    order.order_items.forEach((item, index) => {
      const rate = Number(item.tax_rate ?? 19);
      const { gross, net, ust } = lineVatBreakdown(Number(item.total), rate);

      rows.push([
        ctx.kasseId,
        zNr,
        order.id,
        String(index + 1),
        "Umsatz",
        "Umsatz",
        "0",
        String(mapUstSchluessel(rate)),
        mapUstSatz(rate),
        formatDsfinvkAmount(gross * sign),
        formatDsfinvkAmount(net * sign),
        formatDsfinvkAmount(ust * sign),
      ]);
    });
  }

  return rowsToCsv(headers, rows);
}

export function buildStammKassenCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_KASSE_BRAND",
    "Z_KASSE_MODELL",
    "Z_KASSE_SERIENNR",
    "Z_KASSE_SW_BRAND",
    "Z_KASSE_SW_VERSION",
    "Z_KASSE_BASISWAEH_CODE",
  ];

  return rowsToCsv(headers, [
    [
      ctx.kasseId,
      "Vera",
      "Vera Cloud POS",
      ctx.fiskalyClientId || ctx.kasseId,
      "Vera Connect Group",
      APP_VERSION,
      ctx.currency,
    ],
  ]);
}

export function buildStammOrteCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "NAME",
    "STRASSE",
    "PLZ",
    "ORT",
  ];

  return rowsToCsv(headers, [
    [
      ctx.kasseId,
      ctx.locationName,
      ctx.locationAddress,
      ctx.locationPostalCode,
      ctx.locationCity,
    ],
  ]);
}

export function buildStammTseCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "TSE_ID",
    "TSE_SERIAL",
    "TSE_SIG_ALGO",
    "TSE_ZEITFORMAT",
    "TSE_PD_ENCODING",
    "TSE_PUBLIC_KEY",
    "TSE_ZERTIFIKAT_I",
    "TSE_ZERTIFIKAT_II",
  ];

  const sampleTse =
    allDsfinvkExportOrders(ctx)
      .map((order) => parseTseData(order.tse_data))
      .find(Boolean) ?? null;

  const tseSerial = sampleTse?.tss_serial ?? ctx.fiskalyTssId;

  return rowsToCsv(headers, [
    [
      ctx.kasseId,
      tseSerial,
      tseSerial,
      "ecdsa-plain-SHA256",
      "unixTime",
      "UTF-8",
      sampleTse?.public_key ?? "",
      "",
      "",
    ],
  ]);
}

export function buildReferencesCsv(ctx: DsfinvkExportContext): string {
  const headers = [
    "Z_KASSE_ID",
    "Z_NR",
    "BON_ID",
    "POS_ZEILE",
    "REF_TYP",
    "REF_NAME",
    "REF_DATUM",
    "REF_Z_KASSE_ID",
    "REF_Z_NR",
    "REF_BON_ID",
  ];

  const rows: string[][] = [];

  for (const [stornoId, storno] of ctx.stornoRecords) {
    const stornoBusinessDate = orderBusinessDate(
      storno.createdAt,
      ctx.locationTimezone
    );
    const originalBusinessDate = orderBusinessDate(
      storno.originalCreatedAt,
      ctx.locationTimezone
    );
    const zNr = String(ctx.closingNumberByDate.get(stornoBusinessDate) ?? "");
    const refZNr = String(
      ctx.closingNumberByDate.get(originalBusinessDate) ?? ""
    );

    rows.push([
      ctx.kasseId,
      zNr,
      stornoId,
      "",
      "Transaktion",
      "Stornierung",
      berlinTimestamp(storno.createdAt),
      ctx.kasseId,
      refZNr,
      storno.originalOrderId,
    ]);
  }

  return rowsToCsv(headers, rows);
}

export function buildDsfinvkCsvFiles(ctx: DsfinvkExportContext): Record<string, string> {
  return {
    "cashpointclosing.csv": buildCashpointClosingCsv(ctx),
    "transactions.csv": buildTransactionsCsv(ctx),
    "transactions_tse.csv": buildTransactionsTseCsv(ctx),
    "lines.csv": buildLinesCsv(ctx),
    "lines_vat.csv": buildLinesVatCsv(ctx),
    "payment.csv": buildPaymentCsv(ctx),
    "businesscases.csv": buildBusinesscasesCsv(ctx),
    "bon_referenzen.csv": buildReferencesCsv(ctx),
    "stamm_kassen.csv": buildStammKassenCsv(ctx),
    "stamm_orte.csv": buildStammOrteCsv(ctx),
    "stamm_tse.csv": buildStammTseCsv(ctx),
  };
}

export async function zipDsfinvkCsvFiles(
  files: Record<string, string>
): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function isoDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function generateDsfinvkExport(
  organizationId: string,
  locationId: string,
  fromDate: Date,
  toDate: Date
): Promise<Buffer> {
  const admin = createAdminClient();

  const [{ data: location, error: locationError }, { data: org, error: orgError }, { data: register }] =
    await Promise.all([
      admin
        .from("locations")
        .select("id, org_id, name, address, city, postal_code, timezone")
        .eq("id", locationId)
        .eq("org_id", organizationId)
        .maybeSingle(),
      admin
        .from("organizations")
        .select("currency, fiskaly_tss_id, fiskaly_client_id")
        .eq("id", organizationId)
        .maybeSingle(),
      admin
        .from("fiscal_registers")
        .select("kassen_id, fiskaly_tss_id, fiskaly_client_id")
        .eq("location_id", locationId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  if (locationError || !location) {
    throw new Error("Location could not be loaded.");
  }
  if (orgError || !org) {
    throw new Error("Organization could not be loaded.");
  }

  const locationRow = location as {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    timezone: string;
  };
  const orgRow = org as {
    currency: string;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  };
  const registerRow = register as {
    kassen_id: string;
    fiskaly_tss_id: string;
    fiskaly_client_id: string;
  } | null;

  const kasseId = registerRow?.kassen_id ?? locationRow.id;
  const fiskalyTssId =
    registerRow?.fiskaly_tss_id ?? orgRow.fiskaly_tss_id ?? "";
  const fiskalyClientId =
    registerRow?.fiskaly_client_id ?? orgRow.fiskaly_client_id ?? "";

  const fromIso = isoDateOnly(fromDate);
  const toIso = isoDateOnly(toDate);

  const journalCtx = await tryLoadJournalDsfinvkContext(
    admin,
    organizationId,
    locationId,
    fromDate,
    toDate,
    locationRow,
    orgRow,
    registerRow
  );

  if (journalCtx) {
    return zipDsfinvkCsvFiles(buildDsfinvkCsvFiles(journalCtx));
  }

  const { data: closings, error: closingsError } = await admin
    .from("daily_closings" as never)
    .select(
      "id, business_date, z_nr, total_gross, total_cash, total_non_cash, closed_at, order_count"
    )
    .eq("location_id", locationId)
    .eq("org_id", organizationId)
    .gte("business_date", fromIso)
    .lte("business_date", toIso)
    .order("business_date", { ascending: true });

  if (closingsError) {
    throw new Error("Daily closings could not be loaded.");
  }

  const closingRows = (closings ?? []) as DsfinvkClosingRow[];
  const closingNumberByDate = new Map<string, number>();
  closingRows.forEach((closing, index) => {
    closingNumberByDate.set(
      closing.business_date,
      closing.z_nr ?? index + 1
    );
  });

  const closingDates = new Set(closingRows.map((row) => row.business_date));
  if (!closingDates.size) {
    const ctx: DsfinvkExportContext = {
      kasseId,
      locationName: locationRow.name,
      locationAddress: locationRow.address ?? "",
      locationCity: locationRow.city ?? "",
      locationPostalCode: locationRow.postal_code ?? "",
      locationTimezone: locationRow.timezone || BERLIN_TZ,
      currency: (orgRow.currency ?? "EUR").toUpperCase(),
      fiskalyClientId,
      fiskalyTssId,
      closings: [],
      closingNumberByDate,
      orders: [],
      stornoBonOrders: [],
      stornoRecords: new Map(),
      staffNames: new Map(),
    };
    return zipDsfinvkCsvFiles(buildDsfinvkCsvFiles(ctx));
  }

  const rangeStart = formatInTimeZone(
    fromDate,
    locationRow.timezone || BERLIN_TZ,
    "yyyy-MM-dd'T'00:00:00XXX"
  );
  const rangeEnd = formatInTimeZone(
    toDate,
    locationRow.timezone || BERLIN_TZ,
    "yyyy-MM-dd'T'23:59:59XXX"
  );

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select(
      "id, order_number, subtotal, total, tax_amount, payment_method, payment_status, status, created_at, accepted_at, delivered_at, is_takeaway, tse_signature, tse_data, created_by_staff_id, order_source, order_items(product_name, quantity, total, tax_rate)"
    )
    .eq("location_id", locationId)
    .gte("created_at", rangeStart)
    .lte("created_at", rangeEnd)
    .order("created_at", { ascending: true });

  if (ordersError) {
    throw new Error("Orders could not be loaded.");
  }

  const timezone = locationRow.timezone || BERLIN_TZ;
  const revenueOrders = ((orders ?? []) as unknown as DsfinvkOrderRow[]).filter(
    (order) => {
      const businessDate = orderBusinessDate(order.created_at, timezone);
      if (!closingDates.has(businessDate)) return false;
      return countsTowardRevenue(order.status);
    }
  );

  const { data: stornoRowsRaw, error: stornoError } = await admin
    .from("storno_records")
    .select(
      "id, original_order_id, storno_amount, created_at, tse_storno_signature, tse_storno_data"
    )
    .eq("location_id", locationId)
    .eq("org_id", organizationId)
    .gte("created_at", rangeStart)
    .lte("created_at", rangeEnd)
    .order("created_at", { ascending: true });

  if (stornoError) {
    throw new Error("Storno records could not be loaded.");
  }

  type StornoRecordRow = {
    id: string;
    original_order_id: string;
    storno_amount: number;
    created_at: string;
    tse_storno_signature: string | null;
    tse_storno_data: unknown;
  };

  const stornoRows = (stornoRowsRaw ?? []) as StornoRecordRow[];
  const stornoRecords = new Map<string, DsfinvkStornoRecordMeta>();
  const stornoBonOrders: DsfinvkOrderRow[] = [];

  const originalOrderIds = [
    ...new Set(stornoRows.map((row) => row.original_order_id)),
  ];

  const originalOrdersById = new Map<string, DsfinvkOrderRow>();
  if (originalOrderIds.length > 0) {
    const { data: originalOrdersRaw, error: originalOrdersError } = await admin
      .from("orders")
      .select(
        "id, order_number, subtotal, total, tax_amount, payment_method, payment_status, status, created_at, accepted_at, delivered_at, is_takeaway, tse_signature, tse_data, created_by_staff_id, order_source, order_items(product_name, quantity, total, tax_rate)"
      )
      .in("id", originalOrderIds);

    if (originalOrdersError) {
      throw new Error("Original storno orders could not be loaded.");
    }

    for (const order of (originalOrdersRaw ?? []) as unknown as DsfinvkOrderRow[]) {
      originalOrdersById.set(order.id, order);
    }
  }

  for (const record of stornoRows) {
    const stornoBusinessDate = orderBusinessDate(record.created_at, timezone);
    if (!closingDates.has(stornoBusinessDate)) continue;

    const original = originalOrdersById.get(record.original_order_id);
    if (!original) continue;

    stornoRecords.set(record.id, {
      originalOrderId: record.original_order_id,
      stornoAmount: Number(record.storno_amount),
      createdAt: record.created_at,
      originalCreatedAt: original.created_at,
    });
    stornoBonOrders.push(buildStornoBonOrder(record, original));
  }

  const staffIds = [
    ...new Set(
      [...revenueOrders, ...stornoBonOrders]
        .map((order) => order.created_by_staff_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const staffNames = new Map<string, string>();
  if (staffIds.length) {
    const { data: staffRows } = await admin
      .from("staff")
      .select("id, name, email")
      .in("id", staffIds);

    for (const row of staffRows ?? []) {
      const staff = row as {
        id: string;
        name: string;
        email: string | null;
      };
      staffNames.set(
        staff.id,
        staff.name?.trim() || staff.email?.trim() || staff.id
      );
    }
  }

  const ctx: DsfinvkExportContext = {
    kasseId,
    locationName: locationRow.name,
    locationAddress: locationRow.address ?? "",
    locationCity: locationRow.city ?? "",
    locationPostalCode: locationRow.postal_code ?? "",
    locationTimezone: timezone,
    currency: (orgRow.currency ?? "EUR").toUpperCase(),
    fiskalyClientId,
    fiskalyTssId,
    closings: closingRows,
    closingNumberByDate,
    orders: revenueOrders,
    stornoBonOrders,
    stornoRecords,
    staffNames,
  };

  return zipDsfinvkCsvFiles(buildDsfinvkCsvFiles(ctx));
}

export function dsfinvkExportFilename(
  locationName: string,
  from: Date,
  to: Date
): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const safeName = locationName
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  return `DSFinV-K_Export_${safeName || "Location"}_${fmt(from)}_${fmt(to)}.zip`;
}

export function parseDsfinvkDateRange(
  fromParam: string | null,
  toParam: string | null
) {
  return parseDatevDateRange(fromParam, toParam);
}
