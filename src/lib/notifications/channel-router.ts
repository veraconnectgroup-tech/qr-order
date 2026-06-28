import {
  hasChannelConsent,
  isGuestSubscribed,
  loadGuestNotificationPreferences,
  logGuestNotificationSend,
} from "@/lib/notifications/guest-preferences";
import { sendSms, isSmsConfigured } from "@/lib/notifications/sms-provider";
import {
  sendWhatsApp,
  isWhatsAppConfigured,
} from "@/lib/notifications/whatsapp-provider";
import type {
  GuestNotificationChannel,
  RouteGuestNotificationInput,
  RouteGuestNotificationResult,
} from "@/lib/notifications/types";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";
import { notifyWaitlistGuestPush } from "@/lib/denis/commerce/waitlist-push-store";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CHANNEL_ORDER: GuestNotificationChannel[] = [
  "push",
  "whatsapp",
  "sms",
];

function resolveChannelOrder(input: {
  preferred: GuestNotificationChannel | null;
  pushAvailable: boolean;
}): GuestNotificationChannel[] {
  const available = DEFAULT_CHANNEL_ORDER.filter((channel) => {
    if (channel === "push") return input.pushAvailable;
    if (channel === "sms") return isSmsConfigured();
    if (channel === "whatsapp") return isWhatsAppConfigured();
    return false;
  });

  if (!input.preferred) return available;
  const rest = available.filter((channel) => channel !== input.preferred);
  return input.preferred && available.includes(input.preferred)
    ? [input.preferred, ...rest]
    : available;
}

async function tryPush(
  admin: SupabaseClient,
  input: RouteGuestNotificationInput
): Promise<boolean> {
  if (input.sessionId) {
    const result = await notifyGuestSessionPush(admin, {
      sessionId: input.sessionId,
      pushType: "guest-denis-message",
      message: input.message,
    });
    return result.sent > 0;
  }

  const waitlistResult = await notifyWaitlistGuestPush(
    input.locationId,
    input.deviceFingerprint,
    {
      title: input.title ?? "Denis",
      body: input.message,
      url: input.url,
      sound: true,
      urgent: input.kind === "transactional",
    }
  );
  return waitlistResult;
}

async function trySms(input: {
  phone: string;
  message: string;
  templateId: string;
}): Promise<boolean> {
  const result = await sendSms({
    to: input.phone,
    body: input.message,
    templateId: input.templateId,
  });
  return "ok" in result && result.ok;
}

async function tryWhatsApp(input: {
  phone: string;
  message: string;
  templateId: string;
}): Promise<boolean> {
  const result = await sendWhatsApp({
    to: input.phone,
    body: input.message,
    templateId: input.templateId,
  });
  return "ok" in result && result.ok;
}

/**
 * Route guest notification with channel priority:
 * Push (PWA) → WhatsApp → SMS — respects preferred channel when set.
 */
export async function routeGuestNotification(
  admin: SupabaseClient,
  input: RouteGuestNotificationInput
): Promise<RouteGuestNotificationResult> {
  const prefs = await loadGuestNotificationPreferences(admin, {
    locationId: input.locationId,
    deviceFingerprint: input.deviceFingerprint,
  });

  if (!isGuestSubscribed(prefs)) {
    return { sentVia: null, skippedReason: "unsubscribed" };
  }

  const phone = input.phone?.trim() || prefs?.phoneE164?.trim() || null;
  const channels = resolveChannelOrder({
    preferred: prefs?.preferredChannel ?? null,
    pushAvailable: Boolean(input.pushAvailable ?? input.sessionId),
  });

  for (const channel of channels) {
    if (!hasChannelConsent(prefs, channel, input.kind)) continue;

    let sent = false;
    if (channel === "push") {
      sent = await tryPush(admin, input);
    } else if (channel === "sms" && phone) {
      sent = await trySms({
        phone,
        message: input.message,
        templateId: input.templateId,
      });
    } else if (channel === "whatsapp" && phone) {
      sent = await tryWhatsApp({
        phone,
        message: input.message,
        templateId: input.templateId,
      });
    }

    if (!sent) continue;

    await logGuestNotificationSend(admin, {
      locationId: input.locationId,
      deviceFingerprint: input.deviceFingerprint,
      phoneE164: phone,
      channel,
      kind: input.kind,
      templateId: input.templateId,
      body: input.message,
    });

    return { sentVia: channel };
  }

  logger.info("routeGuestNotification: no channel delivered", {
    locationId: input.locationId,
    templateId: input.templateId,
    kind: input.kind,
  });

  return { sentVia: null, skippedReason: "no_channel_available" };
}

export { DEFAULT_CHANNEL_ORDER, resolveChannelOrder };
