import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import type { OutboxInsert } from "@/lib/outbox/types";
import { logger } from "@/lib/logger";

export type SessionPaymentNotifyInput = {
  sessionId: string;
  locationId: string;
  orgId: string;
  paymentIntentId: string;
  amountCents: number;
  orderIds: string[];
};

export async function markSessionOrdersPaidOnline(
  admin: ReturnType<typeof createAdminClient>,
  input: SessionPaymentNotifyInput
): Promise<void> {
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_source")
    .in("id", input.orderIds);

  for (const order of (orders ?? []) as Array<{
    id: string;
    order_source: string;
  }>) {
    const paymentMethod = order.order_source === "pos" ? "pos_online" : "online";
    await admin
      .from("orders")
      .update({ payment_method: paymentMethod } as never)
      .eq("id", order.id);
  }

  await admin
    .from("session_payment_intents" as never)
    .update({
      status: "succeeded",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("stripe_payment_intent_id", input.paymentIntentId);

  const { data: integration } = await admin
    .from("pos_integrations")
    .select("id, provider, status")
    .eq("location_id", input.locationId)
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) return;

  const integrationRow = integration as {
    id: string;
    provider: string;
    status: string;
  };

  const event: OutboxInsert = {
    aggregate_id: input.sessionId,
    domain: "fulfillment",
    event_type: "fulfill.notify_pos_payment",
    payload: {
      sessionId: input.sessionId,
      locationId: input.locationId,
      orgId: input.orgId,
      paymentIntentId: input.paymentIntentId,
      amountCents: input.amountCents,
      orderIds: input.orderIds,
      posIntegrationId: integrationRow.id,
      provider: integrationRow.provider,
    },
  };

  try {
    await enqueueOutboxEvents(admin, [event]);
  } catch (error) {
    logger.error("Failed to enqueue POS payment notify", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
