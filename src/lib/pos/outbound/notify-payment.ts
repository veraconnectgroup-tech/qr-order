import { createHmac, randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const NOTIFY_TIMEOUT_MS = 10_000;

export type PosPaymentNotifyPayload = {
  sessionId: string;
  locationId: string;
  paymentIntentId: string;
  amountCents: number;
  orderIds: string[];
  paidAt: string;
};

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function notifyPosPaymentConfirmed(
  provider: string,
  config: Record<string, unknown>,
  payload: PosPaymentNotifyPayload
): Promise<void> {
  const url =
    typeof config.payment_notify_url === "string"
      ? config.payment_notify_url.trim()
      : "";

  if (!url) {
    logger.info("POS payment notify skipped — no payment_notify_url", {
      provider,
      sessionId: payload.sessionId,
    });
    return;
  }

  const secret =
    typeof config.webhook_secret === "string" ? config.webhook_secret.trim() : "";

  const body = JSON.stringify({
    id: randomUUID(),
    event: "session.paid_online",
    created_at: payload.paidAt,
    data: {
      session_id: payload.sessionId,
      location_id: payload.locationId,
      payment_intent_id: payload.paymentIntentId,
      amount_cents: payload.amountCents,
      order_ids: payload.orderIds,
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Vera-Event": "session.paid_online",
  };

  if (secret) {
    headers["X-Vera-Signature"] = `sha256=${signPayload(secret, body)}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `POS payment notify failed ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
    );
  }

  logger.info("POS payment notify delivered", {
    provider,
    sessionId: payload.sessionId,
    url,
  });
}

export async function recordPosOutboundEvent(input: {
  posIntegrationId: string;
  eventType: string;
  success: boolean;
  errorMessage?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("pos_outbound_events").insert({
    pos_integration_id: input.posIntegrationId,
    event_type: input.eventType,
    success: input.success,
    error_message: input.errorMessage ?? null,
  });
}
