import type { TakeawayReadyNotification } from "@/lib/denis/commerce/delivery-mode";
import { buildTakeawayReadyNotification } from "@/lib/denis/commerce/delivery-mode";
import { routeGuestNotification } from "@/lib/notifications/channel-router";
import { buildTakeawayReadySms } from "@/lib/notifications/templates";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyTakeawayReadyInput = {
  locationId: string;
  orderId: string;
  orderNumber: number;
  mode: "takeaway" | "delivery";
  guestEmail?: string | null;
  guestPhone?: string | null;
  deviceFingerprint?: string | null;
  pushAvailable?: boolean;
  orderUrl?: string;
  language?: string;
};

export type NotifyTakeawayReadyResult = {
  notification: TakeawayReadyNotification;
  pushSent: boolean;
  smsSent: boolean;
  emailQueued: boolean;
};

/**
 * Builds Denis takeaway/delivery ready notification and dispatches via channel router.
 */
export async function notifyTakeawayReady(
  input: NotifyTakeawayReadyInput
): Promise<NotifyTakeawayReadyResult> {
  const notification = buildTakeawayReadyNotification({
    orderNumber: input.orderNumber,
    mode: input.mode,
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    pushAvailable: input.pushAvailable,
    orderUrl: input.orderUrl,
    language: input.language,
  });

  let pushSent = false;
  let smsSent = false;

  if (input.deviceFingerprint) {
    const admin = createAdminClient();
    const smsBody = buildTakeawayReadySms(input.language);
    const result = await routeGuestNotification(admin, {
      locationId: input.locationId,
      deviceFingerprint: input.deviceFingerprint,
      kind: "transactional",
      templateId: "takeaway.order_ready",
      message: smsBody,
      title: notification.title,
      url: notification.url,
      phone: input.guestPhone,
      pushAvailable: input.pushAvailable,
    });

    if (result.sentVia === "push") pushSent = true;
    if (result.sentVia === "sms" || result.sentVia === "whatsapp") smsSent = true;
  } else if (notification.channels.includes("push")) {
    try {
      const secret = process.env.CRON_SECRET;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
      if (secret && baseUrl) {
        const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
        const res = await fetch(`${url}/api/push/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            locationId: input.locationId,
            type: "order-ready",
            title: notification.title,
            body: notification.body,
            url: notification.url,
            sound: true,
          }),
        });
        pushSent = res.ok;
      }
    } catch (error) {
      logger.warn("takeaway.ready.push_failed", {
        orderId: input.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    notification,
    pushSent,
    smsSent,
    emailQueued: notification.channels.includes("email"),
  };
}
