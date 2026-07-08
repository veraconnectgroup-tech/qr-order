import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSensitiveAction } from "@/lib/audit/record-sensitive-action";
import { isCashPaymentMethod } from "@/lib/loss-prevention/cash-risk";

export type SweepOpenCashSessionsInput = {
  openMinutesThreshold?: number;
  now?: Date;
};

export type SweepOpenCashSessionsResult = {
  scanned: number;
  flagged: number;
};

const TERMINAL_ORDER_STATUSES = '("rejected","cancelled")';

/** ADR-044 S5 — flag cash sessions with unpaid balance open past threshold. */
export async function sweepOpenCashSessions(
  admin: SupabaseClient,
  input: SweepOpenCashSessionsInput = {}
): Promise<SweepOpenCashSessionsResult> {
  const thresholdMinutes = input.openMinutesThreshold ?? 120;
  const now = input.now ?? new Date();
  const cutoff = new Date(
    now.getTime() - thresholdMinutes * 60 * 1000
  ).toISOString();

  const { data: sessions, error } = await admin
    .from("table_sessions")
    .select("id, location_id, opened_at, tables(name)")
    .eq("status", "active")
    .lt("opened_at", cutoff);

  if (error || !sessions?.length) {
    return { scanned: 0, flagged: 0 };
  }

  let flagged = 0;

  for (const session of sessions) {
    const row = session as {
      id: string;
      location_id: string;
      opened_at: string;
      tables: { name: string } | { name: string }[] | null;
    };

    const { data: orders } = await admin
      .from("orders")
      .select("id, total, payment_status, payment_method, created_at")
      .eq("session_id", row.id)
      .not("status", "in", TERMINAL_ORDER_STATUSES)
      .neq("payment_status", "paid");

    const unpaid = (orders ?? []) as Array<{
      id: string;
      total: number;
      payment_status: string;
      payment_method: string;
      created_at: string;
    }>;

    const cashUnpaid = unpaid.filter((order) =>
      isCashPaymentMethod(order.payment_method)
    );
    if (cashUnpaid.length === 0) {
      continue;
    }

    const openBalance = cashUnpaid.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
    const tableRel = row.tables;
    const tableName = Array.isArray(tableRel)
      ? tableRel[0]?.name ?? null
      : tableRel?.name ?? null;

    const dayKey = now.toISOString().slice(0, 10);
    const result = await recordSensitiveAction(admin, {
      sessionId: row.id,
      action: "payment_mismatch",
      targetType: "session",
      targetId: row.id,
      actorType: "system",
      reason: "Open cash session past threshold",
      riskFlag: true,
      context: {
        openBalance,
        openedAt: row.opened_at,
        thresholdMinutes,
        tableName,
        unpaidOrderCount: cashUnpaid.length,
      },
      idempotencyKey: `cash-session-open:${row.id}:${dayKey}`,
    });

    if (result.ok) {
      flagged += 1;
    }
  }

  return { scanned: sessions.length, flagged };
}
