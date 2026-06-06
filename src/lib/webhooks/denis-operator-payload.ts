import type { DenisOperatorWebhookEvent } from "@/lib/webhooks/events";
import type { SessionOutcome } from "@/lib/operator/types";

export const DENIS_WEBHOOK_API_VERSION = "2026-05-29" as const;

export type DenisOperatorWebhookPayload = {
  orgId: string;
  locationId: string;
  sessionId?: string;
  outcome?: SessionOutcome;
  metrics?: Record<string, unknown>;
  traceId?: string;
  created_at: string;
  proposalId?: string;
};

export function buildDenisOperatorWebhookData(
  input: Omit<DenisOperatorWebhookPayload, "created_at"> & {
    created_at?: string;
  }
): DenisOperatorWebhookPayload {
  return {
    orgId: input.orgId,
    locationId: input.locationId,
    sessionId: input.sessionId,
    outcome: input.outcome,
    metrics: input.metrics,
    traceId: input.traceId,
    proposalId: input.proposalId,
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

export function denisOperatorPayloadHasNoPii(
  payload: DenisOperatorWebhookPayload
): boolean {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "session_token",
    "qr_token",
    "device_fingerprint",
    "guest_email",
    "payment_instrument",
  ];
  return !forbidden.some((key) => serialized.includes(key));
}

export type DenisOperatorWebhookEnvelope = {
  id: string;
  type: DenisOperatorWebhookEvent;
  apiVersion: typeof DENIS_WEBHOOK_API_VERSION;
  createdAt: string;
  orgId: string;
  locationId?: string;
  data: DenisOperatorWebhookPayload;
  traceId?: string;
};
