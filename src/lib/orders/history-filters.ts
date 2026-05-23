import {
  resolveAnalyticsDateRange,
  type AnalyticsSearchParams,
} from "@/lib/analytics/date-range";
import { createAdminClient } from "@/lib/supabase/admin";

export const HISTORY_PAGE_SIZE = 50;
export const HISTORY_CSV_MAX_ROWS = 10_000;
export const HISTORY_STATS_MAX_ROWS = 5_000;

export type HistoryStatusFilter = "all" | "completed" | "cancelled" | "refunded";
export type HistoryPaymentFilter =
  | "all"
  | "online"
  | "at_bar"
  | "card_at_table";
export type HistorySourceFilter = "all" | "guest" | "staff";

export type HistorySearchParams = AnalyticsSearchParams & {
  status?: string;
  payment?: string;
  source?: string;
  q?: string;
  page?: string;
};

export type ParsedHistoryFilters = {
  range: ReturnType<typeof resolveAnalyticsDateRange>;
  status: HistoryStatusFilter;
  payment: HistoryPaymentFilter;
  source: HistorySourceFilter;
  search: string;
  page: number;
};

export const ORDER_HISTORY_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name), table_sessions(guest_email), refund_staff:refunded_by(name), tip_staff:tip_staff_id(name), split_payments(*), audit_log(action, amount, created_at)";

// Supabase query builder typing is too strict for shared filter helpers.
type HistoryQuery = {
  gte: (column: string, value: string) => HistoryQuery;
  lte: (column: string, value: string) => HistoryQuery;
  eq: (column: string, value: string | number) => HistoryQuery;
  in: (column: string, values: string[]) => HistoryQuery;
  or: (filters: string) => HistoryQuery;
};

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

export function parseHistoryFilters(
  params: HistorySearchParams
): ParsedHistoryFilters {
  const pageRaw = Number(params.page ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    range: resolveAnalyticsDateRange(params),
    status: parseEnum(
      params.status,
      ["all", "completed", "cancelled", "refunded"] as const,
      "all"
    ),
    payment: parseEnum(
      params.payment,
      ["all", "online", "at_bar", "card_at_table"] as const,
      "all"
    ),
    source: parseEnum(
      params.source,
      ["all", "guest", "staff"] as const,
      "all"
    ),
    search: (params.q ?? "").trim(),
    page,
  };
}

export function applyHistoryFilters<Q extends HistoryQuery>(
  query: Q,
  filters: ParsedHistoryFilters
): Q {
  let next = query
    .gte("created_at", filters.range.start.toISOString())
    .lte("created_at", filters.range.end.toISOString()) as Q;

  if (filters.status === "completed") {
    next = next.eq("status", "delivered") as Q;
  } else if (filters.status === "cancelled") {
    next = next.in("status", ["cancelled", "rejected"]) as Q;
  } else if (filters.status === "refunded") {
    next = next.in("payment_status", ["refunded", "partial_refund"]) as Q;
  }

  if (filters.payment !== "all") {
    next = next.eq("payment_method", filters.payment) as Q;
  }

  if (filters.source === "guest") {
    next = next.in("order_source", ["qr", "kiosk"]) as Q;
  } else if (filters.source === "staff") {
    next = next.eq("order_source", "staff") as Q;
  }

  return next;
}

export async function applyHistorySearch<Q extends HistoryQuery>(
  query: Q,
  locationId: string,
  search: string
): Promise<Q> {
  const q = search.trim();
  if (!q) return query;

  const numMatch = q.replace(/^#/, "").match(/^\d+$/);
  if (numMatch) {
    return query.eq("order_number", Number.parseInt(numMatch[0], 10)) as Q;
  }

  const admin = createAdminClient();
  const [{ data: tables }, { data: sessions }] = await Promise.all([
    admin
      .from("tables")
      .select("id")
      .eq("location_id", locationId)
      .ilike("name", `%${q}%`),
    admin
      .from("table_sessions")
      .select("id")
      .eq("location_id", locationId)
      .ilike("guest_email", `%${q}%`),
  ]);

  const tableIds = ((tables ?? []) as Array<{ id: string }>).map((t) => t.id);
  const sessionIds = ((sessions ?? []) as Array<{ id: string }>).map(
    (s) => s.id
  );

  if (!tableIds.length && !sessionIds.length) {
    return query.eq("id", "00000000-0000-0000-0000-000000000000") as Q;
  }

  const parts: string[] = [];
  if (tableIds.length) parts.push(`table_id.in.(${tableIds.join(",")})`);
  if (sessionIds.length) parts.push(`session_id.in.(${sessionIds.join(",")})`);

  return query.or(parts.join(",")) as Q;
}

export function historyParamsToQueryString(
  params: HistorySearchParams
): string {
  const query = new URLSearchParams();
  if (params.preset) query.set("preset", params.preset);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.payment && params.payment !== "all") {
    query.set("payment", params.payment);
  }
  if (params.source && params.source !== "all") query.set("source", params.source);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page !== "1") query.set("page", params.page);
  return query.toString();
}
