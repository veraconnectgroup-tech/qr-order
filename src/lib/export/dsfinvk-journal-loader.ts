import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import {
  type DsfinvkClosingRow,
  type DsfinvkExportContext,
  type DsfinvkOrderRow,
  type DsfinvkStornoRecordMeta,
  buildStornoBonOrder,
  orderBusinessDate,
} from "@/lib/export/dsfinvk";
import { parseDsfinvkOrderRows } from "@/lib/export/parse-export-order-rows";
import { roundMoney } from "@/lib/tax/vat";

const BERLIN_TZ = "Europe/Berlin";

type JournalTxRow = {
  id: string;
  order_id: string | null;
  storno_of_id: string | null;
  tx_type: "sale" | "storno" | "z_closing";
  business_date: string;
  gross_total: number;
  net_total: number;
  tax_total: number;
  payment_method: string | null;
  tse_signature: string | null;
  tse_data: unknown;
  signed_at: string | null;
  bon_number: number | null;
  z_nr: number | null;
};

type JournalLineRow = {
  fiscal_transaction_id: string;
  line_no: number;
  product_name: string;
  quantity: number;
  gross: number;
  tax_rate: number;
};

function isoDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function tryLoadJournalDsfinvkContext(
  admin: SupabaseClient,
  organizationId: string,
  locationId: string,
  fromDate: Date,
  toDate: Date,
  locationRow: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    timezone: string;
  },
  orgRow: {
    currency: string;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  },
  registerRow: {
    kassen_id: string;
    fiskaly_tss_id: string;
    fiskaly_client_id: string;
  } | null
): Promise<DsfinvkExportContext | null> {
  const fromIso = isoDateOnly(fromDate);
  const toIso = isoDateOnly(toDate);
  const timezone = locationRow.timezone || BERLIN_TZ;

  const { data: journalTxs, error: journalError } = await admin
    .from("fiscal_transactions")
    .select(
      "id, order_id, storno_of_id, tx_type, business_date, gross_total, net_total, tax_total, payment_method, tse_signature, tse_data, signed_at, bon_number, z_nr"
    )
    .eq("location_id", locationId)
    .eq("org_id", organizationId)
    .eq("status", "signed")
    .gte("business_date", fromIso)
    .lte("business_date", toIso)
    .order("signed_at", { ascending: true });

  if (journalError || !journalTxs?.length) {
    return null;
  }

  const txs = journalTxs as JournalTxRow[];
  const saleAndStorno = txs.filter((tx) => tx.tx_type !== "z_closing");
  if (saleAndStorno.length === 0 && !txs.some((tx) => tx.tx_type === "z_closing")) {
    return null;
  }

  const txIds = txs.map((tx) => tx.id);
  const orderIds = [
    ...new Set(
      txs
        .map((tx) => tx.order_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: linesRaw }, { data: closingsRaw }, { data: ordersRaw }] =
    await Promise.all([
      admin
        .from("fiscal_transaction_lines")
        .select(
          "fiscal_transaction_id, line_no, product_name, quantity, gross, tax_rate"
        )
        .in("fiscal_transaction_id", txIds)
        .order("line_no", { ascending: true }),
      admin
        .from("daily_closings" as never)
        .select(
          "id, business_date, z_nr, total_gross, total_cash, total_non_cash, closed_at, order_count, fiscal_transaction_id"
        )
        .eq("location_id", locationId)
        .eq("org_id", organizationId)
        .gte("business_date", fromIso)
        .lte("business_date", toIso)
        .order("business_date", { ascending: true }),
      orderIds.length
        ? admin
            .from("orders")
            .select(
              "id, order_number, subtotal, total, tax_amount, payment_method, payment_status, status, created_at, accepted_at, delivered_at, is_takeaway, tse_signature, tse_data, created_by_staff_id, order_source"
            )
            .in("id", orderIds)
        : Promise.resolve({ data: [] }),
    ]);

  const linesByTx = new Map<string, JournalLineRow[]>();
  for (const line of (linesRaw ?? []) as JournalLineRow[]) {
    const list = linesByTx.get(line.fiscal_transaction_id) ?? [];
    list.push(line);
    linesByTx.set(line.fiscal_transaction_id, list);
  }

  const ordersById = new Map<string, DsfinvkOrderRow>();
  for (const order of parseDsfinvkOrderRows(ordersRaw)) {
    ordersById.set(order.id, { ...order, order_items: [] });
  }

  if (orderIds.length) {
    const { data: itemsRaw } = await admin
      .from("order_items")
      .select("order_id, product_name, quantity, total, tax_rate")
      .in("order_id", orderIds);

    for (const item of (itemsRaw ?? []) as Array<{
      order_id: string;
      product_name: string;
      quantity: number;
      total: number;
      tax_rate: number | null;
    }>) {
      const order = ordersById.get(item.order_id);
      if (!order) continue;
      order.order_items.push({
        product_name: item.product_name,
        quantity: Number(item.quantity),
        total: Number(item.total),
        tax_rate: item.tax_rate,
      });
    }
  }

  const closingRows = (closingsRaw ?? []) as DsfinvkClosingRow[];
  const closingNumberByDate = new Map<string, number>();

  for (const closing of closingRows) {
    if (closing.z_nr != null) {
      closingNumberByDate.set(closing.business_date, closing.z_nr);
    }
  }

  for (const tx of txs.filter((row) => row.tx_type === "z_closing")) {
    if (tx.z_nr != null) {
      closingNumberByDate.set(tx.business_date, tx.z_nr);
    }
  }

  closingRows.forEach((closing, index) => {
    if (!closingNumberByDate.has(closing.business_date)) {
      closingNumberByDate.set(closing.business_date, closing.z_nr ?? index + 1);
    }
  });

  const closingDates = new Set(closingRows.map((row) => row.business_date));
  for (const tx of txs.filter((row) => row.tx_type === "z_closing")) {
    closingDates.add(tx.business_date);
  }

  const revenueOrders: DsfinvkOrderRow[] = [];
  const stornoBonOrders: DsfinvkOrderRow[] = [];
  const stornoRecords = new Map<string, DsfinvkStornoRecordMeta>();

  for (const tx of txs) {
    if (tx.tx_type === "z_closing") continue;
    if (!closingDates.has(tx.business_date)) continue;

    if (tx.tx_type === "sale" && tx.order_id) {
      const base = ordersById.get(tx.order_id);
      if (!base) continue;

      const journalLines = linesByTx.get(tx.id) ?? [];
      const items =
        journalLines.length > 0
          ? journalLines.map((line) => ({
              product_name: line.product_name,
              quantity: Number(line.quantity),
              total: Number(line.gross),
              tax_rate: Number(line.tax_rate),
            }))
          : base.order_items;

      revenueOrders.push({
        ...base,
        id: tx.order_id,
        subtotal: Number(tx.net_total),
        tax_amount: Number(tx.tax_total),
        total: Number(tx.gross_total),
        tse_signature: tx.tse_signature ?? base.tse_signature,
        tse_data: tx.tse_data ?? base.tse_data,
        order_items: items,
      });
      continue;
    }

    if (tx.tx_type === "storno" && tx.order_id) {
      const original = ordersById.get(tx.order_id);
      if (!original) continue;

      const stornoRecord = {
        id: tx.id,
        original_order_id: tx.order_id,
        storno_amount: Number(tx.gross_total),
        created_at: tx.signed_at ?? new Date().toISOString(),
        tse_storno_signature: tx.tse_signature,
        tse_storno_data: tx.tse_data,
      };

      stornoRecords.set(tx.id, {
        originalOrderId: tx.order_id,
        stornoAmount: Number(tx.gross_total),
        createdAt: stornoRecord.created_at,
        originalCreatedAt: original.created_at,
      });

      const bon = buildStornoBonOrder(stornoRecord, original);
      stornoBonOrders.push({
        ...bon,
        id: tx.id,
        created_at: stornoRecord.created_at,
        accepted_at: stornoRecord.created_at,
        delivered_at: stornoRecord.created_at,
        subtotal: roundMoney(Number(tx.net_total)),
        tax_amount: roundMoney(Number(tx.tax_total)),
        total: Number(tx.gross_total),
        tse_signature: tx.tse_signature,
        tse_data: tx.tse_data,
        order_items:
          (linesByTx.get(tx.id) ?? []).map((line) => ({
            product_name: line.product_name,
            quantity: Number(line.quantity),
            total: Number(line.gross),
            tax_rate: Number(line.tax_rate),
          })) || bon.order_items,
      });
    }
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
      const staff = row as { id: string; name: string; email: string | null };
      staffNames.set(
        staff.id,
        staff.name?.trim() || staff.email?.trim() || staff.id
      );
    }
  }

  const kasseId = registerRow?.kassen_id ?? locationRow.id;
  const fiskalyTssId =
    registerRow?.fiskaly_tss_id ?? orgRow.fiskaly_tss_id ?? "";
  const fiskalyClientId =
    registerRow?.fiskaly_client_id ?? orgRow.fiskaly_client_id ?? "";

  return {
    kasseId,
    locationName: locationRow.name,
    locationAddress: locationRow.address ?? "",
    locationCity: locationRow.city ?? "",
    locationPostalCode: locationRow.postal_code ?? "",
    locationTimezone: timezone,
    currency: (orgRow.currency ?? "EUR").toUpperCase(),
    fiskalyClientId,
    fiskalyTssId,
    closings: closingRows.length
      ? closingRows
      : txs
          .filter((tx) => tx.tx_type === "z_closing")
          .map((tx) => ({
            id: tx.id,
            business_date: tx.business_date,
            z_nr: tx.z_nr,
            total_gross: Number(tx.gross_total),
            total_cash: 0,
            total_non_cash: Number(tx.gross_total),
            closed_at: tx.signed_at ?? formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
            order_count: 0,
          })),
    closingNumberByDate,
    orders: revenueOrders,
    stornoBonOrders,
    stornoRecords,
    staffNames,
  };
}
