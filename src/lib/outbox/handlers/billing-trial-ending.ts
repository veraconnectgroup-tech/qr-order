import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { buildTrialEndingNotification } from "@/lib/billing/trial";

export type BillingTrialEndingOutboxPayload = {
  orgId?: string;
  locationId?: string;
  daysLeft?: number;
  traceId?: string;
};

/** Notify venue staff when trial has ≤3 days left. */
export async function handleBillingTrialEnding(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as BillingTrialEndingOutboxPayload;
  const locationId = data.locationId;
  const daysLeft = data.daysLeft ?? 3;

  if (!locationId) {
    throw new Error("billing.trial_ending missing locationId");
  }

  const notification = buildTrialEndingNotification(daysLeft);
  const result = await notifyLocationPush(locationId, notification);

  logger.info("Outbox billing.trial_ending delivered", {
    orgId: data.orgId,
    locationId,
    daysLeft,
    traceId: data.traceId,
    ...result,
  });
}
