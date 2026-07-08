import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSuspiciousFlagCopy } from "@/lib/loss-prevention/flag-copy";
import type { SensitiveActionRow } from "@/lib/audit/sensitive-action-types";

export type OpenSuspiciousFlag = {
  id: string;
  action: string;
  orderId: string | null;
  sessionId: string | null;
  createdAt: string;
  reason: string | null;
  context: Record<string, unknown>;
  copy: string;
  tableName: string | null;
  orderNumber: number | null;
};

function asContext(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Load unresolved risk flags for Ops Center / daily digest — ADR-044 S7. */
export async function loadOpenSuspiciousFlags(
  admin: SupabaseClient,
  locationId: string,
  options: { limit?: number; sinceIso?: string } = {}
): Promise<OpenSuspiciousFlag[]> {
  const limit = options.limit ?? 50;

  let query = admin
    .from("order_events")
    .select(
      "id, order_id, session_id, sensitive_action, created_at, reason, context, risk_flag, resolved_at"
    )
    .eq("risk_flag", true)
    .is("resolved_at", null)
    .not("sensitive_action", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.sinceIso) {
    query = query.gte("created_at", options.sinceIso);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  const rows = data as SensitiveActionRow[];
  const orderIds = [
    ...new Set(rows.map((row) => row.order_id).filter(Boolean)),
  ] as string[];

  const orderMeta = new Map<
    string,
    { location_id: string; order_number: number; table_name: string | null }
  >();

  if (orderIds.length > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("id, location_id, order_number, tables(name)")
      .in("id", orderIds);

    for (const order of orders ?? []) {
      const row = order as {
        id: string;
        location_id: string;
        order_number: number;
        tables: { name: string } | { name: string }[] | null;
      };
      const tableRel = row.tables;
      const tableName = Array.isArray(tableRel)
        ? tableRel[0]?.name ?? null
        : tableRel?.name ?? null;
      orderMeta.set(row.id, {
        location_id: row.location_id,
        order_number: row.order_number,
        table_name: tableName,
      });
    }
  }

  const flags: OpenSuspiciousFlag[] = [];

  for (const row of rows) {
    const meta = row.order_id ? orderMeta.get(row.order_id) : undefined;
    if (meta && meta.location_id !== locationId) {
      continue;
    }

    const context = asContext(row.context);
    const tableName =
      (context.tableName as string | undefined) ??
      meta?.table_name ??
      null;
    const orderNumber = meta?.order_number ?? null;
    const amount =
      typeof context.amount === "number" ? context.amount : null;

    flags.push({
      id: row.id,
      action: row.sensitive_action ?? "unknown",
      orderId: row.order_id,
      sessionId: row.session_id,
      createdAt: row.created_at,
      reason: row.reason,
      context,
      tableName,
      orderNumber,
      copy: buildSuspiciousFlagCopy({
        action: row.sensitive_action ?? "payment_mismatch",
        tableName,
        orderNumber,
        amount,
        voidPhase:
          (context.voidPhase as "queued" | "in_prep" | "served" | "paid" | undefined) ??
          null,
        reasonMissing: !row.reason,
      }),
    });
  }

  return flags;
}
