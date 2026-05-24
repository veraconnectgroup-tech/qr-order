import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type InboundEventStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "rejected"
  | "failed";

export function hashInboundPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export async function recordPosInboundEvent(input: {
  posIntegrationId: string;
  eventType: string;
  externalId?: string | null;
  payloadHash: string;
  processingStatus?: InboundEventStatus;
  httpStatus?: number;
  errorMessage?: string | null;
  orderId?: string | null;
  sessionId?: string | null;
  durationMs?: number | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pos_inbound_events")
    .insert({
      pos_integration_id: input.posIntegrationId,
      event_type: input.eventType,
      external_id: input.externalId ?? null,
      payload_hash: input.payloadHash,
      processing_status: input.processingStatus ?? "received",
      http_status: input.httpStatus ?? null,
      error_message: input.errorMessage ?? null,
      order_id: input.orderId ?? null,
      session_id: input.sessionId ?? null,
      duration_ms: input.durationMs ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

export async function touchPosIntegrationSync(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  errorMessage?: string | null
) {
  const now = new Date().toISOString();
  const update = errorMessage
    ? { last_sync_at: now, last_error: errorMessage, status: "error" as const }
    : { last_sync_at: now, last_error: null, status: "connected" as const };

  await admin
    .from("pos_integrations")
    .update({ ...update, updated_at: now })
    .eq("id", integrationId);
}
