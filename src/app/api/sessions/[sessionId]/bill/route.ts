import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { safeJsonParse } from "@/lib/api/safe-json";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { executeOrderSaga } from "@/lib/orders/order-saga";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { isPaymentMethodAllowed } from "@/lib/orders/shared/payment-method";
import type { PaymentMethod } from "@/lib/constants";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { getCurrentTraceId } from "@/lib/resilience/trace";
import { isUuid } from "@/lib/security/sanitize";
import { closeTableSession } from "@/lib/sessions/session-devices";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { logger } from "@/lib/logger";
import type { Staff } from "@/types";

type SessionOrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  tip_amount: number | null;
  payment_method: string;
  payment_status: string;
  is_split: boolean;
  created_at: string;
  order_items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
};

const settleSchema = z.object({
  payment_method: z
    .enum(["at_bar", "card_at_table", "card_terminal", "online"])
    .optional()
    .default("at_bar"),
});

async function loadStaff(): Promise<Staff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (staff as Staff | null) ?? null;
}

async function verifyStaffSessionAccess(sessionId: string) {
  const staff = await loadStaff();
  if (
    !staff ||
    !["owner", "manager", "staff", "waiter"].includes(staff.role)
  ) {
    return { error: apiError("Unauthorized.", 401) as ReturnType<typeof apiError> };
  }

  if (!isUuid(sessionId)) {
    return { error: apiError("Invalid session id.", 400) as ReturnType<typeof apiError> };
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("table_sessions")
    .select("id, location_id, table_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return { error: apiError("Session not found.", 404) as ReturnType<typeof apiError> };
  }

  const sessionRow = session as {
    id: string;
    location_id: string;
    table_id: string;
    status: string;
  };

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", sessionRow.location_id)
    .single();

  if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
    return { error: apiError("Unauthorized.", 403) as ReturnType<typeof apiError> };
  }

  if (
    staff.location_id &&
    staff.location_id !== sessionRow.location_id
  ) {
    return { error: apiError("Unauthorized.", 403) as ReturnType<typeof apiError> };
  }

  return { staff, session: sessionRow, admin };
}

function mapBillOrders(orders: SessionOrderRow[]) {
  return orders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total: Number(order.total),
    tip_amount: Number(order.tip_amount ?? 0),
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    created_at: order.created_at,
    order_items: (order.order_items ?? []).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
    })),
  }));
}

function summarizeBill(orders: SessionOrderRow[]) {
  const subtotal = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const tips = orders.reduce(
    (sum, order) => sum + Number(order.tip_amount ?? 0),
    0
  );
  const paidOrders = orders.filter((order) =>
    isPaidPaymentStatus(order.payment_status)
  );
  const unpaidOrders = orders.filter(
    (order) => !isPaidPaymentStatus(order.payment_status)
  );

  return {
    subtotal,
    tips,
    grand_total: subtotal + tips,
    paid_count: paidOrders.length,
    unpaid_count: unpaidOrders.length,
    all_paid: unpaidOrders.length === 0,
  };
}

export const GET = withErrorHandler(
  "session-bill-get",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { sessionId } = await ctx.params;
    const access = await verifyStaffSessionAccess(sessionId);
    if ("error" in access && access.error) {
      return access.error;
    }

    const { admin } = access;
    const { data: ordersRaw, error } = await admin
      .from("orders")
      .select(
        "id, order_number, status, total, tip_amount, payment_method, payment_status, is_split, created_at"
      )
      .eq("session_id", sessionId)
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    const orderRows =
      (ordersRaw as Array<Omit<SessionOrderRow, "order_items">>) ?? [];
    const orderIds = orderRows.map((order) => order.id);

    const itemsByOrder = new Map<
      string,
      SessionOrderRow["order_items"]
    >();

    if (orderIds.length > 0) {
      const { data: itemRows } = await admin
        .from("order_items")
        .select("order_id, product_name, quantity, unit_price")
        .in("order_id", orderIds);

      for (const item of (itemRows ?? []) as Array<{
        order_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>) {
        const list = itemsByOrder.get(item.order_id) ?? [];
        list.push({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
        itemsByOrder.set(item.order_id, list);
      }
    }

    const orders: SessionOrderRow[] = orderRows.map((order) => ({
      ...order,
      order_items: itemsByOrder.get(order.id) ?? [],
    }));
    const summary = summarizeBill(orders);

    return apiSuccess({
      session_id: sessionId,
      orders: mapBillOrders(orders),
      ...summary,
    });
  }
);

export const POST = withErrorHandler(
  "session-bill-settle",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { sessionId } = await ctx.params;
    const access = await verifyStaffSessionAccess(sessionId);
    if ("error" in access && access.error) {
      return access.error;
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const paymentMethod = parsed.data.payment_method;
    const { staff, session, admin } = access;

    if (session.status !== "active") {
      return apiError("Session is already closed.", 409);
    }

    const { data: location } = await admin
      .from("locations")
      .select(
        "org_id, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
      )
      .eq("id", session.location_id)
      .single();

    if (!location) {
      return apiError("Location not found.", 404);
    }

    const locationRow = location as {
      org_id: string;
      payment_online_enabled: boolean;
      payment_at_bar_enabled: boolean;
      payment_card_at_table_enabled: boolean;
    };

    const { data: org } = await admin
      .from("organizations")
      .select("stripe_onboarded")
      .eq("id", locationRow.org_id)
      .single();

    const orgRow = (org as { stripe_onboarded: boolean } | null) ?? {
      stripe_onboarded: false,
    };

    if (
      !isPaymentMethodAllowed(
        paymentMethod as PaymentMethod,
        locationRow,
        orgRow
      )
    ) {
      return apiError("Payment method not enabled for this location.", 400);
    }

    const { data: unpaidRaw, error: unpaidError } = await admin
      .from("orders")
      .select("id, total, tip_amount, payment_status, payment_method, is_split")
      .eq("session_id", sessionId)
      .neq("payment_status", "paid")
      .not("status", "in", '("rejected","cancelled")');

    if (unpaidError) {
      return apiError(unpaidError.message, 500);
    }

    const unpaidOrders =
      (unpaidRaw as Array<{
        id: string;
        total: number;
        tip_amount: number | null;
        payment_status: string;
        payment_method: string;
        is_split: boolean;
      }>) ?? [];

    if (unpaidOrders.some((order) => order.is_split)) {
      return apiError(
        "This bill is being split. Settle individual shares first.",
        400
      );
    }

    const traceId = getCurrentTraceId() ?? crypto.randomUUID();
    const inPersonMethods = new Set(["at_bar", "card_at_table"]);

    if (unpaidOrders.length > 0) {
      const { error: methodError } = await admin
        .from("orders")
        .update({ payment_method: paymentMethod } as never)
        .eq("session_id", sessionId)
        .neq("payment_status", "paid")
        .not("status", "in", '("rejected","cancelled")');

      if (methodError) {
        return apiError(methodError.message, 500);
      }

      for (const order of unpaidOrders) {
        if (
          paymentMethod === "online" ||
          paymentMethod === "card_terminal" ||
          order.payment_status === "processing"
        ) {
          continue;
        }

        if (!inPersonMethods.has(paymentMethod)) {
          continue;
        }

        const tipAmount = Number(order.tip_amount ?? 0);
        const amountCents =
          Math.round(Number(order.total) * 100) +
          Math.round(tipAmount * 100);

        void executeOrderSaga(order.id, traceId, {
          amountCents,
          tipAmount,
        }).catch((err) =>
          logger.error("Order saga failed on session settle", {
            orderId: order.id,
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      }

      const { error: paidError } = await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: paymentMethod,
        } as never)
        .eq("session_id", sessionId)
        .neq("payment_status", "paid")
        .not("status", "in", '("rejected","cancelled")');

      if (paidError) {
        return apiError(paidError.message, 500);
      }
    }

    await closeTableSession(admin, sessionId, "settled");

    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "update",
      entityType: "table_session",
      entityId: sessionId,
      newValue: {
        bill_status: "settled",
        payment_method: paymentMethod,
        settled_orders: unpaidOrders.length,
      },
      request: req,
    });

    dispatchOrgWebhook(staff.org_id, "session.closed", {
      session_id: sessionId,
      table_id: session.table_id,
      bill_status: "settled",
    });

    return apiSuccess({ settled: true });
  }
);
