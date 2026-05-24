import { GenericInboundAdapter } from "@/lib/pos/inbound/adapters/generic-inbound";
import type { PosInboundEvent } from "@/lib/pos/inbound/types";
import {
  verifyPosWebhookSignature,
  webhookSecretFromConfig,
} from "@/lib/pos/inbound/verify-signature";

/**
 * Deliverect inbound uses the generic normalizer with Deliverect-specific
 * signature headers. Status-only outbound echo webhooks remain on the legacy route.
 */
export class DeliverectInboundAdapter extends GenericInboundAdapter {
  provider = "deliverect";

  override verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
    config: Record<string, unknown>
  ): boolean {
    const secret =
      webhookSecretFromConfig(config) ??
      (typeof process.env.DELIVERECT_WEBHOOK_SECRET === "string"
        ? process.env.DELIVERECT_WEBHOOK_SECRET.trim()
        : null);

    if (!secret) return false;
    return verifyPosWebhookSignature(rawBody, headers, secret);
  }

  override parseEvent(
    rawBody: Record<string, unknown>,
    headers?: Headers
  ): PosInboundEvent {
    return super.parseEvent(rawBody, headers);
  }
}
