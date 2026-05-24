import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyPosPaymentConfirmed,
  recordPosOutboundEvent,
} from "@/lib/pos/outbound/notify-payment";
import type { Json } from "@/types/database";

type NotifyPosPaymentPayload = {
  sessionId?: string;
  locationId?: string;
  orgId?: string;
  paymentIntentId?: string;
  amountCents?: number;
  orderIds?: string[];
  posIntegrationId?: string;
  provider?: string;
};

export async function handleFulfillNotifyPosPayment(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as NotifyPosPaymentPayload;

  if (
    !data.sessionId ||
    !data.locationId ||
    !data.paymentIntentId ||
    !data.posIntegrationId ||
    !data.provider ||
    !Array.isArray(data.orderIds)
  ) {
    throw new Error("fulfill.notify_pos_payment missing required fields");
  }

  const admin = createAdminClient();

  const { data: integration, error } = await admin
    .from("pos_integrations")
    .select("id, status, config, provider")
    .eq("id", data.posIntegrationId)
    .single();

  if (error || !integration) {
    throw new Error("POS integration not found for payment notify");
  }

  const row = integration as {
    id: string;
    status: string;
    config: Json;
    provider: string;
  };

  if (row.status !== "connected") {
    return;
  }

  const config =
    row.config && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};

  const paidAt = new Date().toISOString();

  try {
    await notifyPosPaymentConfirmed(row.provider, config, {
      sessionId: data.sessionId,
      locationId: data.locationId,
      paymentIntentId: data.paymentIntentId,
      amountCents: data.amountCents ?? 0,
      orderIds: data.orderIds,
      paidAt,
    });

    await recordPosOutboundEvent({
      posIntegrationId: row.id,
      eventType: "session.paid_online",
      success: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordPosOutboundEvent({
      posIntegrationId: row.id,
      eventType: "session.paid_online",
      success: false,
      errorMessage: message,
    });
    throw err;
  }
}
