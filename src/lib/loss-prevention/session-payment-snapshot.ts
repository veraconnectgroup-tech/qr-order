import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionPaymentSnapshot = {
  sessionId: string;
  openBalance: number;
  paidTotal: number;
  hasPartialPayment: boolean;
  hasPaidOrder: boolean;
  orderCount: number;
};

const TERMINAL_ORDER_STATUSES = '("rejected","cancelled")';

/** Snapshot session payment state before transfer/split risk checks — ADR-044 S3/S4. */
export async function loadSessionPaymentSnapshot(
  admin: SupabaseClient,
  sessionId: string
): Promise<SessionPaymentSnapshot | null> {
  const { data, error } = await admin
    .from("orders")
    .select("id, total, payment_status")
    .eq("session_id", sessionId)
    .not("status", "in", TERMINAL_ORDER_STATUSES);

  if (error) {
    return null;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    total: number;
    payment_status: string;
  }>;

  let openBalance = 0;
  let paidTotal = 0;
  let hasPartialPayment = false;
  let hasPaidOrder = false;

  for (const row of rows) {
    const total = Number(row.total);
    if (row.payment_status === "paid") {
      hasPaidOrder = true;
      paidTotal += total;
    } else if (row.payment_status === "processing" || row.payment_status === "partial_refund") {
      hasPartialPayment = true;
      openBalance += total;
    } else {
      openBalance += total;
    }
  }

  return {
    sessionId,
    openBalance: Math.round(openBalance * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100,
    hasPartialPayment,
    hasPaidOrder,
    orderCount: rows.length,
  };
}

export function sessionHasPaymentActivity(
  snapshot: SessionPaymentSnapshot | null
): boolean {
  if (!snapshot) return false;
  return snapshot.hasPaidOrder || snapshot.hasPartialPayment;
}
