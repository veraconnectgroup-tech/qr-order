import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

type CommerceStaffAlertPayload = {
  commerceEventId?: string;
  sessionId?: string;
  locationId?: string;
  orgId?: string;
  orderId?: string;
  sentiment?: string;
  category?: string | null;
  traceId?: string;
};

/** ADR-014 CE-2 — notify staff when guest submits negative feedback. */
export async function handleCommerceStaffAlert(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as CommerceStaffAlertPayload;

  if (!data.locationId || !data.sessionId) {
    throw new Error("commerce.alert.staff missing locationId or sessionId");
  }

  const categoryLabel = data.category ? ` (${data.category})` : "";

  const result = await notifyLocationPush(data.locationId, {
    title: "Guest feedback needs attention",
    body: `Negative feedback${categoryLabel} — check Denis copilot or feedback inbox.`,
    url: "/dashboard/denis",
  });

  logger.info("Outbox commerce.alert.staff delivered", {
    orgId: data.orgId,
    locationId: data.locationId,
    sessionId: data.sessionId,
    orderId: data.orderId,
    commerceEventId: data.commerceEventId,
    traceId: data.traceId,
    ...result,
  });
}
