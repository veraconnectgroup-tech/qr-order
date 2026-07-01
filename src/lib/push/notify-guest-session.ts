import { logger } from "@/lib/logger";
import {
  buildGuestDenisMessagePush,
  buildGuestOrderReadyPush,
  resolvePushSoundProfile,
  resolvePushVibrate,
  type GuestPushType,
} from "@/lib/push/push-intelligence";
import { sendPush, isPushConfigured } from "@/lib/push/vapid";
import type { SupabaseClient } from "@supabase/supabase-js";

type GuestPushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type NotifyGuestSessionPushInput = {
  sessionId: string;
  pushType: GuestPushType;
  message: string;
  title?: string;
  url?: string;
  orderNumber?: number;
  language?: string;
};

export type NotifyGuestSessionPushResult = {
  sent: number;
  failed: number;
  removed: number;
};

function resolveGuestPushCopy(input: NotifyGuestSessionPushInput): {
  title: string;
  body: string;
} {
  if (input.pushType === "guest-order-ready" && input.orderNumber != null) {
    return buildGuestOrderReadyPush({
      orderNumber: input.orderNumber,
      language: input.language,
    });
  }

  if (input.pushType === "guest-denis-message") {
    return buildGuestDenisMessagePush({
      preview: input.message,
      language: input.language,
    });
  }

  return {
    title: input.title ?? "Denis",
    body: input.message,
  };
}

/** Guest session Web Push with sound profile + Denis copy templates. */
export async function notifyGuestSessionPush(
  admin: SupabaseClient,
  input: NotifyGuestSessionPushInput
): Promise<NotifyGuestSessionPushResult> {
  const empty = { sent: 0, failed: 0, removed: 0 };
  if (!isPushConfigured()) return empty;

  const { data, error } = await admin
    .from("guest_push_subscriptions" as never)
    .select("id, endpoint, p256dh, auth")
    .eq("session_id", input.sessionId);

  if (error) {
    if (error.code === "42P01") {
      logger.warn("guest_push_subscriptions missing — run migration 00102");
      return empty;
    }
    logger.warn("notifyGuestSessionPush load failed", { error: error.message });
    return empty;
  }

  const rows = (data ?? []) as GuestPushRow[];
  if (!rows.length) return empty;

  const copy = resolveGuestPushCopy(input);
  const soundProfile = resolvePushSoundProfile(input.pushType);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of rows) {
    const result = await sendPush(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      {
        title: copy.title,
        body: copy.body,
        url: input.url,
        sound: true,
        type: input.pushType,
        soundProfile,
        vibrate: resolvePushVibrate(input.pushType),
      }
    );

    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;

    if (result.expired) {
      const { error: deleteError } = await admin
        .from("guest_push_subscriptions" as never)
        .delete()
        .eq("id", row.id);

      if (!deleteError) removed += 1;
    }
  }

  return { sent, failed, removed };
}
