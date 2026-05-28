import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

export type BillingLowBalanceOutboxPayload = {
  orgId?: string;
  locationId?: string;
  balance?: number;
  threshold?: number;
  traceId?: string;
};

/** ADR-009 F4 — notify venue staff when AI credits drop below threshold. */
export async function handleBillingLowBalance(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as BillingLowBalanceOutboxPayload;
  const locationId = data.locationId;
  const balance = data.balance ?? 0;
  const threshold = data.threshold ?? 10;

  if (!locationId) {
    throw new Error("billing.low_balance missing locationId");
  }

  const result = await notifyLocationPush(locationId, {
    title: "Denis AI credits low",
    body: `${balance} credits left (threshold ${threshold}). Top up in Admin.`,
    url: "/admin/ai",
  });

  logger.info("Outbox billing.low_balance delivered", {
    orgId: data.orgId,
    locationId,
    balance,
    threshold,
    traceId: data.traceId,
    ...result,
  });
}

/** Alias for staff-facing billing alerts (ADR-009 F4). */
export const handleBillingStaffHint = handleBillingLowBalance;
