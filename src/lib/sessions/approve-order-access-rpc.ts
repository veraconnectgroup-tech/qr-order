import { generateTablePin, hashTablePin } from "@/lib/sessions/table-pin";
import { getActiveTableSession } from "@/lib/sessions/session-devices";
import type { createAdminClient } from "@/lib/supabase/admin";

export type ApproveOrderAccessTxResult = {
  sessionId: string;
  sessionToken: string;
  orderNumber: number;
  alreadyApproved: boolean;
  pinWasNew: boolean;
};

function mapApproveRpcError(message: string): { error: string; status: number } {
  if (message.includes("order_not_found")) {
    return { error: "Order not found.", status: 404 };
  }
  if (
    message.includes("order_not_awaiting_approval") ||
    message.includes("order_update_failed") ||
    message.includes("order_reject_failed")
  ) {
    return { error: "Order is not awaiting approval.", status: 409 };
  }
  if (message.includes("order_no_table")) {
    return { error: "Order has no table.", status: 400 };
  }
  return { error: "Order could not be approved.", status: 500 };
}

export async function approveOrderAccessTx(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    orderId: string;
    staffId: string;
    tableId: string;
    deviceFingerprint: string | null;
    userAgent?: string | null;
  }
): Promise<
  | { data: ApproveOrderAccessTxResult; pinPlain: string }
  | { error: string; status: number }
> {
  let pinPlain = "";
  let pinHash = "";

  const existingSession = await getActiveTableSession(admin, input.tableId);
  if (!existingSession) {
    pinPlain = generateTablePin();
    pinHash = hashTablePin(pinPlain);
  }

  const { data, error } = await admin.rpc("approve_order_access_tx", {
    p_order_id: input.orderId,
    p_staff_id: input.staffId,
    p_pin_hash: pinHash,
    p_device_fingerprint: input.deviceFingerprint,
    p_user_agent: input.userAgent ?? null,
  });

  if (error) {
    return mapApproveRpcError(error.message);
  }

  const row = data as {
    session_id: string;
    session_token: string;
    order_number: number;
    already_approved: boolean;
    pin_was_new: boolean;
  };

  return {
    data: {
      sessionId: row.session_id,
      sessionToken: row.session_token,
      orderNumber: row.order_number,
      alreadyApproved: row.already_approved,
      pinWasNew: row.pin_was_new,
    },
    pinPlain: row.pin_was_new ? pinPlain : "",
  };
}

export async function rejectOrderAccessTx(
  admin: ReturnType<typeof createAdminClient>,
  input: { orderId: string; rejectionReason?: string | null }
): Promise<
  | { data: { alreadyRejected: boolean } }
  | { error: string; status: number }
> {
  const { data, error } = await admin.rpc("reject_order_access_tx", {
    p_order_id: input.orderId,
    p_rejection_reason: input.rejectionReason ?? null,
  });

  if (error) {
    if (error.message.includes("order_not_found")) {
      return { error: "Order not found.", status: 404 };
    }
    if (error.message.includes("order_not_awaiting_approval")) {
      return { error: "Order is not awaiting approval.", status: 409 };
    }
    return { error: "Order could not be rejected.", status: 500 };
  }

  const row = data as { already_rejected: boolean };
  return { data: { alreadyRejected: row.already_rejected } };
}
