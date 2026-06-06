import { resolveHandoffSession } from "@/lib/denis/acl/resolve-handoff-session";
import { abortPendingFiscalSale } from "@/lib/fiscal/runtime/fiscal-abort";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
import type { SupabaseClient } from "@supabase/supabase-js";

type OpenOrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  tse_signature: string | null;
  session_id: string | null;
};

export type ExecuteDenisGuestOrderCancelResult =
  | { ok: true; kind: "cancelled"; orderId: string; orderNumber: number }
  | { ok: true; kind: "staff_escalation"; orderNumber: number | null }
  | { ok: false; error: string };

const GUEST_CANCEL_STATUSES = ["pending"] as const;

async function loadLatestOpenOrder(
  admin: SupabaseClient,
  sessionId: string
): Promise<OpenOrderRow | null> {
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, tse_signature, session_id"
    )
    .eq("session_id", sessionId)
    .not("status", "in", '("delivered","cancelled","rejected")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as OpenOrderRow;
}

/** M23 ACL — guest cancel before kitchen accepts (pending only). */
export async function executeDenisGuestOrderCancel(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    sessionToken: string;
  }
): Promise<ExecuteDenisGuestOrderCancelResult> {
  const resolved = await resolveHandoffSession(admin, input);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const order = await loadLatestOpenOrder(admin, resolved.data.sessionId);
  if (!order) {
    return { ok: false, error: "no_open_order" };
  }

  if (
    !GUEST_CANCEL_STATUSES.includes(
      order.status as (typeof GUEST_CANCEL_STATUSES)[number]
    )
  ) {
    return {
      ok: true,
      kind: "staff_escalation",
      orderNumber: order.order_number,
    };
  }

  if (order.payment_status === "paid" || order.payment_status === "processing") {
    return {
      ok: true,
      kind: "staff_escalation",
      orderNumber: order.order_number,
    };
  }

  if (!order.tse_signature) {
    await abortPendingFiscalSale(admin, order.id);
  }

  const { error } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      rejection_reason: "Guest cancelled via Denis before kitchen accepted",
    } as never)
    .eq("id", order.id)
    .eq("status", "pending");

  if (error) {
    return { ok: false, error: "cancel_failed" };
  }

  if (order.session_id) {
    scheduleDenisWorldSignal({
      signal: "commerce.order_status",
      orderId: order.id,
      sessionId: order.session_id,
      status: "cancelled",
      previousStatus: order.status,
    });
  }

  return {
    ok: true,
    kind: "cancelled",
    orderId: order.id,
    orderNumber: order.order_number,
  };
}
