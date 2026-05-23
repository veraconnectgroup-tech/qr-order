import { createAdminClient } from "@/lib/supabase/admin";
import { countsTowardRevenue } from "@/lib/orders/revenue";

/** SKR03 accounts used for DATEV export */
export const DATEV_ACCOUNTS = {
  revenue19: "8400",
  revenue7: "8300",
  bankStripe: "1200",
  cashBar: "1000",
} as const;

export type DatevRow = {
  umsatz: number;
  sollHaben: "S" | "H";
  konto: string;
  gegenkonto: string;
  belegdatum: string;
  buchungstext: string;
  ustSatz: number;
};

type OrderRow = {
  id: string;
  order_number: number;
  subtotal: number;
  total: number;
  tax_amount: number;
  tax_percent: number;
  payment_method: string;
  created_at: string;
  status: string;
  order_items: Array<{ total: number; tax_rate: number }>;
};

function formatDatevAmount(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatDatevDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}${month}${year}`;
}

function escapeCsvField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolveRevenueAccount(
  items: Array<{ total: number; tax_rate: number }>
): { konto: string; ustSatz: number } {
  if (!items.length) {
    return { konto: DATEV_ACCOUNTS.revenue19, ustSatz: 19 };
  }

  const byRate = new Map<number, number>();
  for (const item of items) {
    const rate = Number(item.tax_rate ?? 19);
    byRate.set(rate, (byRate.get(rate) ?? 0) + Number(item.total));
  }

  if (byRate.size === 1) {
    const rate = [...byRate.keys()][0];
    return rate === 7
      ? { konto: DATEV_ACCOUNTS.revenue7, ustSatz: 7 }
      : { konto: DATEV_ACCOUNTS.revenue19, ustSatz: 19 };
  }

  let dominantRate = 19;
  let dominantTotal = 0;
  for (const [rate, total] of byRate) {
    if (total > dominantTotal) {
      dominantTotal = total;
      dominantRate = rate;
    }
  }

  return dominantRate === 7
    ? { konto: DATEV_ACCOUNTS.revenue7, ustSatz: 7 }
    : { konto: DATEV_ACCOUNTS.revenue19, ustSatz: 19 };
}

function paymentGegenkonto(paymentMethod: string): string {
  return paymentMethod === "online"
    ? DATEV_ACCOUNTS.bankStripe
    : DATEV_ACCOUNTS.cashBar;
}

function orderToDatevRow(order: OrderRow): DatevRow {
  const items = order.order_items ?? [];
  const { konto, ustSatz } = resolveRevenueAccount(items);
  const gegenkonto = paymentGegenkonto(order.payment_method);

  return {
    umsatz: Number(order.subtotal),
    sollHaben: "H",
    konto,
    gegenkonto,
    belegdatum: formatDatevDate(order.created_at),
    buchungstext: `Bestellung #${String(order.order_number).padStart(4, "0")}`,
    ustSatz,
  };
}

export function datevRowsToCsv(rows: DatevRow[]): string {
  const header =
    "Umsatz;Soll/Haben;Konto;Gegenkonto;Belegdatum;Buchungstext;USt-Satz";

  const lines = rows.map((row) =>
    [
      formatDatevAmount(row.umsatz),
      row.sollHaben,
      row.konto,
      row.gegenkonto,
      row.belegdatum,
      escapeCsvField(row.buchungstext),
      String(row.ustSatz),
    ].join(";")
  );

  return `\uFEFF${header}\n${lines.join("\n")}\n`;
}

export async function generateDatevExport(
  organizationId: string,
  fromDate: Date,
  toDate: Date
): Promise<string> {
  const admin = createAdminClient();

  const { data: locations, error: locationError } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", organizationId);

  if (locationError) {
    throw new Error("Locations could not be loaded.");
  }

  const locationIds = (locations ?? []).map((row) => (row as { id: string }).id);
  if (!locationIds.length) {
    return datevRowsToCsv([]);
  }

  const rangeStart = new Date(fromDate);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(toDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select(
      "id, order_number, subtotal, total, tax_amount, tax_percent, payment_method, created_at, status, order_items(total, tax_rate)"
    )
    .in("location_id", locationIds)
    .gte("created_at", rangeStart.toISOString())
    .lte("created_at", rangeEnd.toISOString())
    .order("created_at", { ascending: true });

  if (ordersError) {
    throw new Error("Orders could not be loaded.");
  }

  const rows = ((orders ?? []) as unknown as OrderRow[])
    .filter((order) => countsTowardRevenue(order.status))
    .map(orderToDatevRow);

  return datevRowsToCsv(rows);
}

export function parseDatevDateRange(
  fromParam: string | null,
  toParam: string | null
): { from: Date; to: Date } | { error: string } {
  if (!fromParam || !toParam) {
    return { error: "Query parameters from and to are required (ISO dates)." };
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: "Invalid date format. Use ISO dates (YYYY-MM-DD)." };
  }

  if (from > to) {
    return { error: "from must be before or equal to to." };
  }

  return { from, to };
}

export function datevExportFilename(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `DATEV_Export_${fmt(from)}_${fmt(to)}.csv`;
}
