import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERECT_STATUS = {
  received: 10,
  accepted: 20,
  preparing: 30,
  readyForPickup: 40,
  inDelivery: 50,
  delivered: 60,
  cancelled: 70,
  failed: 80,
  autoFinalized: 90,
} as const;

type DeliveryUpdate = {
  status: "delivered" | "failed";
  lastError: string | null;
  deliveredAt: string | null;
};

function parseDeliverectStatus(body: Record<string, unknown>): number | null {
  const raw = body.status;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapDeliverectStatus(status: number): DeliveryUpdate | null {
  if (
    status === DELIVERECT_STATUS.received ||
    status === DELIVERECT_STATUS.accepted ||
    status === DELIVERECT_STATUS.preparing ||
    status === DELIVERECT_STATUS.readyForPickup ||
    status === DELIVERECT_STATUS.inDelivery
  ) {
    return null;
  }

  if (
    status === DELIVERECT_STATUS.delivered ||
    status === DELIVERECT_STATUS.autoFinalized
  ) {
    return { status: "delivered", lastError: null, deliveredAt: new Date().toISOString() };
  }

  if (status === DELIVERECT_STATUS.cancelled) {
    return {
      status: "failed",
      lastError: "deliverect_status:70 POS cancelled",
      deliveredAt: null,
    };
  }

  if (status === DELIVERECT_STATUS.failed) {
    return {
      status: "failed",
      lastError: "deliverect_status:80 POS failed",
      deliveredAt: null,
    };
  }

  return null;
}

async function touchPosIntegrationLastSync(
  admin: ReturnType<typeof createAdminClient>,
  locationId: string
) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("pos_integrations")
    .update({ last_sync_at: now, updated_at: now })
    .eq("location_id", locationId)
    .eq("provider", "deliverect");

  if (error) {
    logger.warn("Deliverect webhook pos_integrations sync update failed", {
      locationId,
      error: error.message,
    });
  }
}

export async function handleDeliverectWebhook(
  body: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  const channelOrderId =
    typeof body.channelOrderId === "string" ? body.channelOrderId.trim() : "";
  const deliverectStatus = parseDeliverectStatus(body);
  const deliverectOrderId =
    typeof body._id === "string" ? body._id : undefined;

  if (!channelOrderId) {
    return { ok: false, message: "Missing channelOrderId" };
  }

  if (!isUuid(channelOrderId)) {
    return { ok: false, message: "Invalid channelOrderId" };
  }

  if (deliverectStatus === null) {
    return { ok: false, message: "Missing or invalid status" };
  }

  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, location_id, status")
    .eq("id", channelOrderId)
    .maybeSingle();

  if (orderError) {
    logger.error("Deliverect webhook order lookup failed", {
      orderId: channelOrderId,
      error: orderError.message,
    });
    return { ok: false, message: "Order lookup failed" };
  }

  if (!order) {
    return { ok: false, message: "Order not found" };
  }

  const orderRow = order as {
    id: string;
    location_id: string;
    status: string;
  };

  const { data: delivery, error: deliveryError } = await admin
    .from("order_channel_deliveries")
    .select("id, status")
    .eq("order_id", channelOrderId)
    .eq("channel", "pos")
    .eq("provider", "deliverect")
    .maybeSingle();

  if (deliveryError) {
    logger.error("Deliverect webhook delivery lookup failed", {
      orderId: channelOrderId,
      error: deliveryError.message,
    });
    return { ok: false, message: "Delivery lookup failed" };
  }

  if (!delivery) {
    return { ok: false, message: "Delivery record not found" };
  }

  const deliveryUpdate = mapDeliverectStatus(deliverectStatus);

  if (deliveryUpdate) {
    const { error: updateError } = await admin
      .from("order_channel_deliveries")
      .update({
        status: deliveryUpdate.status,
        last_error: deliveryUpdate.lastError,
        delivered_at: deliveryUpdate.deliveredAt,
      })
      .eq("id", (delivery as { id: string }).id);

    if (updateError) {
      logger.error("Deliverect webhook delivery update failed", {
        orderId: channelOrderId,
        deliverectStatus,
        error: updateError.message,
      });
      return { ok: false, message: "Delivery update failed" };
    }

    if (
      (deliverectStatus === DELIVERECT_STATUS.cancelled ||
        deliverectStatus === DELIVERECT_STATUS.failed) &&
      (orderRow.status === "accepted" || orderRow.status === "preparing")
    ) {
      logger.warn("POS rejected order", {
        orderId: channelOrderId,
        deliverectStatus,
      });
    }
  }

  await touchPosIntegrationLastSync(admin, orderRow.location_id);

  logger.info("Deliverect webhook processed", {
    orderId: channelOrderId,
    deliverectOrderId,
    deliverectStatus,
    deliveryUpdated: deliveryUpdate !== null,
  });

  return { ok: true, message: "processed" };
}
