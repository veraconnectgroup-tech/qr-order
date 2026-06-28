import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import {
  buildUsageExceededNotification,
  type UsageMetricKey,
} from "@/lib/billing/usage";

export type BillingUsageExceededOutboxPayload = {
  orgId?: string;
  locationId?: string;
  exceededKeys?: UsageMetricKey[];
  traceId?: string;
};

/** Notify venue staff to upgrade when plan usage limits are exceeded. */
export async function handleBillingUsageExceeded(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as BillingUsageExceededOutboxPayload;
  const locationId = data.locationId;
  const exceededKeys = data.exceededKeys ?? ["denisLlmCalls"];

  if (!locationId) {
    throw new Error("billing.usage_exceeded missing locationId");
  }

  const notification = buildUsageExceededNotification(exceededKeys);
  const result = await notifyLocationPush(locationId, notification);

  logger.info("Outbox billing.usage_exceeded delivered", {
    orgId: data.orgId,
    locationId,
    exceededKeys,
    traceId: data.traceId,
    ...result,
  });
}
