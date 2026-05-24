import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { scheduleNewOrderPush } from "@/lib/push/schedule-notify";
import { scheduleOrderTseSign } from "@/lib/fiscal/sign-transaction";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import {
  createActiveSessionWithPin,
  trustSessionDevice,
} from "@/lib/sessions/session-devices";
import { storePinReveal } from "@/lib/sessions/pin-reveal-cache";
import type { Staff } from "@/types";

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
      "id, location_id, table_id, status, order_number, total, device_fingerprint, requires_session_open"
    )
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
    order_number: number;
    total: number;
    device_fingerprint: string | null;
    requires_session_open: boolean;
  };

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

  const { error: updateError } = await admin
    .from("orders")
    .update({
      session_id: sessionId,
      status: "pending",
      requires_session_open: false,
    })
    .eq("id", orderId);

  if (updateError) {
    return { error: "Order could not be updated.", status: 500 };
  }

  if (orderRow.device_fingerprint) {
    await trustSessionDevice(admin, {
      sessionId,
      deviceFingerprint: orderRow.device_fingerprint,
    });
  }

  if (pinPlain) {
    storePinReveal(orderId, pinPlain);
  }

  const { data: table } = await admin
    .from("tables")
    .select("name")
    .eq("id", orderRow.table_id)
    .single();

  scheduleOrderTseSign(orderId);
  scheduleNewOrderPush(
    orderRow.location_id,
    orderRow.order_number,
    (table as { name: string } | null)?.name ?? "Table"
  );

  dispatchOrgWebhook(staff.org_id, "order.created", {
    order_id: orderId,
    order_number: orderRow.order_number,
    location_id: orderRow.location_id,
    total: orderRow.total,
  });

  await admin.from("audit_log").insert({
    action: "session.approved",
    order_id: orderId,
    session_id: sessionId,
    table_id: orderRow.table_id,
    staff_id: staff.id,
    metadata: { order_number: orderRow.order_number },
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
): Promise<{ data: { ok: true } } | { error: string; status: number }> {
  if (!["owner", "manager", "staff", "kitchen"].includes(staff.role)) {
    return { error: "Unauthorized.", status: 403 };
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, location_id, table_id, status")
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
  };

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

  const { error } = await admin
    .from("orders")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason ?? "Order declined by staff.",
    })
    .eq("id", orderId);

  if (error) {
    return { error: "Order could not be rejected.", status: 500 };
  }

  await admin.from("audit_log").insert({
    action: "order.access_rejected",
    order_id: orderId,
    table_id: orderRow.table_id,
    staff_id: staff.id,
    reason: rejectionReason ?? null,
  });

  return { data: { ok: true } };
}
