import { checkRateLimit } from "@/lib/rate-limit";

/** Max 50 webhook deliveries enqueued per org per minute (W1). */
export const WEBHOOK_ORG_RATE_LIMIT = 50;
export const WEBHOOK_ORG_RATE_WINDOW_MS = 60_000;

export function checkWebhookOrgRateLimit(orgId: string): boolean {
  const key = `webhook:org:${orgId}`;
  return checkRateLimit(key, WEBHOOK_ORG_RATE_LIMIT, WEBHOOK_ORG_RATE_WINDOW_MS);
}
