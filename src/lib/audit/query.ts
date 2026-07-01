import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];

export type AuditLogRowView = AuditLogRow & {
  userLabel: string;
};

export type AuditLogFilters = {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

const PAGE_SIZE = 50;

export async function loadAuditLog(
  orgId: string,
  filters: AuditLogFilters = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.action?.trim()) {
    query = query.eq("action", filters.action.trim());
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    return {
      rows: [] as AuditLogRowView[],
      total: 0,
      page,
      pageSize: PAGE_SIZE,
      error: error.message,
    };
  }

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];

  const usersById = new Map<string, { name: string; email: string | null }>();
  if (userIds.length) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("user_id, name, email")
      .eq("org_id", orgId)
      .in("user_id", userIds);

    for (const row of staffRows ?? []) {
      usersById.set(row.user_id, { name: row.name, email: row.email });
    }
  }

  const enriched: AuditLogRowView[] = rows.map((row) => ({
    ...row,
    userLabel:
      (row.user_id && usersById.get(row.user_id)?.name) ||
      (row.user_id && usersById.get(row.user_id)?.email) ||
      "System",
  }));

  return {
    rows: enriched,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "login",
  "export",
  "fiscal",
] as const;
