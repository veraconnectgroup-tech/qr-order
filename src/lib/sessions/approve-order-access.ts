import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { scheduleNewOrderPush } from "@/lib/push/schedule-notify";
import { scheduleOrderTseSign } from "@/lib/fiscal/sign-transaction";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import {
  createActiveSessionWithPin,
  trustSessionDevice,
} from "@/lib/sessions/session-devices";
import { applyDeviceBlockAfterReject } from "@/lib/sessions/order-blocks";
import { storePinReveal } from "@/lib/sessions/pin-reveal-cache";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import type { Staff } from "@/types";

type OrderAccessRow = {
  id: string;
  location_id: string;
  table_id: string | null;
  status: string;
  order_number: number;
  total: number;
  payment_status: string;
  device_fingerprint: string | null;
  requires_session_open: boolean;
  session_id: string | null;
};

async function loadApprovedOrderResult(
  admin: ReturnType<typeof createAdminClient>,
  orderRow: OrderAccessRow
): Promise<
  | {
      data: {
        orderId: string;
        sessionId: string;
        sessionToken: string;
        tablePin: string | null;
        orderNumber: number;
      };
    }
  | { error: string; status: number }
> {
  if (!orderRow.session_id) {
    return { error: "Order is not awaiting approval.", status: 409 };
  }

  const { data: session } = await admin
    .from("table_sessions")
    .select("id, session_token")
    .eq("id", orderRow.session_id)
    .single();

  if (!session) {
    return { error: "Session could not be loaded.", status: 500 };
  }

  const sessionRow = session as { id: string; session_token: string };

  return {
    data: {
      orderId: orderRow.id,
      sessionId: sessionRow.id,
      sessionToken: sessionRow.session_token,
      tablePin: null,
      orderNumber: orderRow.order_number,
    },
  };
}

async function runPostApprovalSideEffects(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    orderId: string;
    sessionId: string;
    tableId: string;
    locationId: string;
    orderNumber: number;
  total: number;
  paymentStatus: string;
  deviceFingerprint: string | null;
    pinPlain: string;
    staffId: string;
    orgId: string;
  }
) {
  try {
    if (input.deviceFingerprint) {
      await trustSessionDevice(admin, {
        sessionId: input.sessionId,
        deviceFingerprint: input.deviceFingerprint,
      });
    }
  } catch (error) {
    logger.warn("Device trust failed after order approval", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (input.pinPlain) {
    storePinReveal(input.orderId, input.pinPlain);
  }

  try {
    const { data: table } = await admin
      .from("tables")
      .select("name")
      .eq("id", input.tableId)
      .single();

    const tableName =
      (table as { name: string } | null)?.name ?? "Table";

    await persistOrderSideEffects(admin, {
      orderId: input.orderId,
      locationId: input.locationId,
      orgId: input.orgId,
      orderNumber: input.orderNumber,
      tableName,
      total: input.total,
      paymentStatus: input.paymentStatus,
      orderSource: "qr",
      phase: "approved",
      actorType: "staff",
      actorId: input.staffId,
    });

    scheduleOrderTseSign(input.orderId);
    scheduleNewOrderPush(
      input.locationId,
      input.orderNumber,
      tableName
    );

    dispatchOrgWebhook(input.orgId, "order.created", {
      order_id: input.orderId,
      order_number: input.orderNumber,
      location_id: input.locationId,
      total: input.total,
    });

    await admin.from("audit_log").insert({
      action: "session.approved",
      order_id: input.orderId,
      session_id: input.sessionId,
      table_id: input.tableId,
      staff_id: input.staffId,
      metadata: { order_number: input.orderNumber },
    });
  } catch (error) {
    logger.warn("Post-approval side effects failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function approveOrderAccess(
  staff: Staff,
  orderId: string
): Promise<
  | {
      data: {
        orderId: string;
        sessionId: string;
        sessionToken: string;
        tablePin: string | null;
        orderNumber: number;
      };
    }
  | { error: string; status: number }
> {
  if (!["owner", "manager", "staff", "kitchen"].includes(staff.role)) {
    return { error: "Unauthorized.", status: 403 };
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, location_id, table_id, status, order_number, total, payment_status, device_fingerprint, requires_session_open, session_id"
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return { error: "Order not found.", status: 404 };
  }

  const orderRow = order as OrderAccessRow;

  if (
    orderRow.status === "pending" &&
    orderRow.session_id &&
    !orderRow.requires_session_open
  ) {
    return loadApprovedOrderResult(admin, orderRow);
  }

  if (orderRow.status !== "pending_approval") {
    return { error: "Order is not awaiting approval.", status: 409 };
  }

  if (!orderRow.table_id) {
    return { error: "Order has no table.", status: 400 };
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
    return { error: "Unauthorized.", status: 403 };
  }

  if (staff.location_id && staff.location_id !== orderRow.location_id) {
    return { error: "Unauthorized.", status: 403 };
  }

  const sessionResult = await createActiveSessionWithPin(admin, {
    tableId: orderRow.table_id,
    locationId: orderRow.location_id,
    approvedByStaffId: staff.id,
  });

  if ("error" in sessionResult) {
    return sessionResult;
  }

  const { sessionId, sessionToken, pinPlain } = sessionResult;

  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update({
      session_id: sessionId,
      status: "pending",
      requires_session_open: false,
    })
    .eq("id", orderId)
    .eq("status", "pending_approval")
    .select(
      "id, location_id, table_id, status, order_number, total, payment_status, device_fingerprint, requires_session_open, session_id"
    )
    .maybeSingle();

  if (updateError) {
    return { error: "Order could not be updated.", status: 500 };
  }

  if (!updatedOrder) {
    const { data: latestOrder } = await admin
      .from("orders")
      .select(
        "id, location_id, table_id, status, order_number, total, device_fingerprint, requires_session_open, session_id"
      )
      .eq("id", orderId)
      .single();

    const latestRow = latestOrder as OrderAccessRow | null;
    if (
      latestRow?.status === "pending" &&
      latestRow.session_id &&
      !latestRow.requires_session_open
    ) {
      return loadApprovedOrderResult(admin, latestRow);
    }

    return { error: "Order is not awaiting approval.", status: 409 };
  }

  await runPostApprovalSideEffects(admin, {
    orderId,
    sessionId,
    tableId: orderRow.table_id,
    locationId: orderRow.location_id,
    orderNumber: orderRow.order_number,
    total: orderRow.total,
    paymentStatus: orderRow.payment_status,
    deviceFingerprint: orderRow.device_fingerprint,
    pinPlain,
    staffId: staff.id,
    orgId: staff.org_id,
  });

  logger.info("Order access approved", {
    orderId,
    sessionId,
    staffId: staff.id,
  });

  return {
    data: {
      orderId,
      sessionId,
      sessionToken,
      tablePin: pinPlain || null,
      orderNumber: orderRow.order_number,
    },
  };
}

export async function rejectOrderAccess(
  staff: Staff,
  orderId: string,
  rejectionReason?: string | null
): Promise<
  | {
      data: {
        ok: true;
        deviceBlocked?: boolean;
        blockedUntil?: string;
        strikeCount?: number;
      };
    }
  | { error: string; status: number }
> {
  if (!["owner", "manager", "staff", "kitchen"].includes(staff.role)) {
    return { error: "Unauthorized.", status: 403 };
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, location_id, table_id, status, device_fingerprint")
    .eq("id", orderId)
    .single();

  if (!order) {
    return { error: "Order not found.", status: 404 };
  }

  const orderRow = order as {
    id: string;
    location_id: string;
    table_id: string | null;
    status: string;
    device_fingerprint: string | null;
  };

  if (orderRow.status === "rejected") {
    return { data: { ok: true } };
  }

  if (orderRow.status !== "pending_approval") {
    return { error: "Order is not awaiting approval.", status: 409 };
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
    return { error: "Unauthorized.", status: 403 };
  }

  const { data: rejectedOrder, error } = await admin
    .from("orders")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason ?? "Order declined by staff.",
    })
    .eq("id", orderId)
    .eq("status", "pending_approval")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Order could not be rejected.", status: 500 };
  }

  if (!rejectedOrder) {
    const { data: latestOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if ((latestOrder as { status: string } | null)?.status === "rejected") {
      return { data: { ok: true } };
    }

    return { error: "Order is not awaiting approval.", status: 409 };
  }

  try {
    await admin.from("audit_log").insert({
      action: "order.access_rejected",
      order_id: orderId,
      table_id: orderRow.table_id,
      staff_id: staff.id,
      reason: rejectionReason ?? null,
    });
  } catch (auditError) {
    logger.warn("Reject audit log failed", {
      orderId,
      error:
        auditError instanceof Error ? auditError.message : String(auditError),
    });
  }

  let blockResult: {
    blocked: boolean;
    blockedUntil?: string;
    strikeCount?: number;
  } = { blocked: false };

  if (orderRow.table_id && orderRow.device_fingerprint) {
    blockResult = await applyDeviceBlockAfterReject(admin, {
      locationId: orderRow.location_id,
      tableId: orderRow.table_id,
      deviceFingerprint: orderRow.device_fingerprint,
    });
  }

  return {
    data: {
      ok: true,
      deviceBlocked: blockResult.blocked,
      blockedUntil: blockResult.blockedUntil,
      strikeCount: blockResult.strikeCount,
    },
  };
}
