import {
  getAvailablePaymentMethods,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { isSessionOrderBlocked } from "@/lib/sessions/session-lifecycle";
import { schedulePaymentRequestPush } from "@/lib/push/schedule-notify";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestSessionPaymentResult =
  | { ok: true; paymentMethod: SelectablePaymentMethod; orderIds: string[] }
  | { ok: false; error: string };

async function loadPaymentOptions(
  admin: SupabaseClient,
  locationId: string
): Promise<SelectablePaymentMethod[] | null> {
  const { data: location } = await admin
    .from("locations")
    .select(
      "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, org_id"
    )
    .eq("id", locationId)
    .single();

  if (!location) return null;

  const loc = location as {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    org_id: string;
  };

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_onboarded")
    .eq("id", loc.org_id)
    .single();

  return getAvailablePaymentMethods({
    stripeOnboarded: Boolean(
      (org as { stripe_onboarded: boolean } | null)?.stripe_onboarded
    ),
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: loc.payment_online_enabled,
    paymentAtBarEnabled: loc.payment_at_bar_enabled,
    paymentCardAtTableEnabled: loc.payment_card_at_table_enabled,
  });
}

/** In-person bill request — same effect as POST /api/sessions/bill (cash / card at table). */
export async function requestSessionPaymentInPerson(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    locationId: string;
    tableId: string;
    tableName: string;
    paymentMethod: Exclude<SelectablePaymentMethod, "online">;
  }
): Promise<RequestSessionPaymentResult> {
  const { data: sessionAccess } = await admin
    .from("table_sessions")
    .select("access_state")
    .eq("id", input.sessionId)
    .single();

  if (
    isSessionOrderBlocked(
      (sessionAccess as { access_state?: string } | null)?.access_state
    )
  ) {
    return { ok: false, error: "session_closing" };
  }

  const methods = await loadPaymentOptions(admin, input.locationId);
  if (!methods?.includes(input.paymentMethod)) {
    return { ok: false, error: "method_unavailable" };
  }

  const { data: orders } = await admin
    .from("orders")
    .select("id, payment_status, is_split")
    .eq("session_id", input.sessionId)
    .not("payment_status", "in", '("paid","pos_online")')
    .not("status", "in", '("rejected","cancelled")');

  const unpaidOrders =
    (orders as Array<{
      id: string;
      payment_status: string;
      is_split: boolean;
    }>) ?? [];

  if (unpaidOrders.length === 0) {
    return { ok: false, error: "nothing_to_pay" };
  }

  if (unpaidOrders.some((o) => o.is_split)) {
    return { ok: false, error: "split_bill_active" };
  }

  const { data: requestedRows } = await admin
    .from("orders")
    .select("id")
    .eq("session_id", input.sessionId)
    .not("payment_requested_at", "is", null)
    .not("status", "in", '("rejected","cancelled")')
    .limit(1);

  if ((requestedRows ?? []).length > 0) {
    return { ok: false, error: "payment_already_requested" };
  }

  const orderIds = unpaidOrders.map((o) => o.id);
  const now = new Date().toISOString();

  const { error } = await admin
    .from("orders")
    .update({
      payment_method: input.paymentMethod,
      payment_requested_at: now,
    })
    .in("id", orderIds);

  if (error) {
    return { ok: false, error: "payment_request_failed" };
  }

  schedulePaymentRequestPush(input.locationId, input.tableName, input.tableId);

  return {
    ok: true,
    paymentMethod: input.paymentMethod,
    orderIds,
  };
}

export async function loadSessionPaymentBeliefs(
  admin: SupabaseClient,
  sessionId: string
): Promise<{
  amountDue: number;
  paymentAlreadyRequested: boolean;
  unpaidCount: number;
}> {
  const { data: ordersRaw } = await admin
    .from("orders")
    .select("total, payment_status, payment_requested_at, status")
    .eq("session_id", sessionId)
    .not("status", "in", '("rejected","cancelled")');

  const rows =
    (ordersRaw as Array<{
      total: number;
      payment_status: string;
      payment_requested_at: string | null;
    }>) ?? [];

  const unpaid = rows.filter((o) => !isPaidPaymentStatus(o.payment_status));
  const amountDue = unpaid.reduce((sum, o) => sum + Number(o.total), 0);
  const paymentAlreadyRequested = unpaid.some(
    (o) => o.payment_requested_at != null
  );

  return {
    amountDue,
    paymentAlreadyRequested,
    unpaidCount: unpaid.length,
  };
}
