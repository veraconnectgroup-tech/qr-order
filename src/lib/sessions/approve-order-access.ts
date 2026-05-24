import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { applyDeviceBlockAfterReject } from "@/lib/sessions/order-blocks";
import { storePinReveal } from "@/lib/sessions/pin-reveal-cache";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import {
  approveOrderAccessTx,
  rejectOrderAccessTx,
} from "@/lib/sessions/approve-order-access-rpc";
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
    pinPlain: string;
    staffId: string;
    orgId: string;
  }
) {
  if (input.pinPlain) {
    await storePinReveal(input.orderId, input.pinPlain);
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

    await admin.from("audit_log_legacy_pre_g3").insert({
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

  const txResult = await approveOrderAccessTx(admin, {
    orderId,
    staffId: staff.id,
    tableId: orderRow.table_id,
    deviceFingerprint: orderRow.device_fingerprint,
  });

  if ("error" in txResult) {
    return txResult;
  }

  const { data: txData, pinPlain } = txResult;

  if (!txData.alreadyApproved) {
    await runPostApprovalSideEffects(admin, {
      orderId,
      sessionId: txData.sessionId,
      tableId: orderRow.table_id,
      locationId: orderRow.location_id,
      orderNumber: orderRow.order_number,
      total: orderRow.total,
      paymentStatus: orderRow.payment_status,
      pinPlain,
      staffId: staff.id,
      orgId: staff.org_id,
    });

    logger.info("Order access approved", {
      orderId,
      sessionId: txData.sessionId,
      staffId: staff.id,
    });
  }

  return {
    data: {
      orderId,
      sessionId: txData.sessionId,
      sessionToken: txData.sessionToken,
      tablePin: pinPlain || null,
      orderNumber: txData.orderNumber,
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

  const rejectResult = await rejectOrderAccessTx(admin, {
    orderId,
    rejectionReason,
  });

  if ("error" in rejectResult) {
    return rejectResult;
  }

  if (!rejectResult.data.alreadyRejected) {
    try {
      await admin.from("audit_log_legacy_pre_g3").insert({
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
  }

  let blockResult: {
    blocked: boolean;
    blockedUntil?: string;
    strikeCount?: number;
  } = { blocked: false };

  if (
    !rejectResult.data.alreadyRejected &&
    orderRow.table_id &&
    orderRow.device_fingerprint
  ) {
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
