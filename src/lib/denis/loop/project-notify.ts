import { logger } from "@/lib/logger";
import { sendPush } from "@/lib/push/vapid";
import { isPushConfigured } from "@/lib/push/vapid";
import type { SupabaseClient } from "@supabase/supabase-js";

type GuestPushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ProjectNotifyGuestInput = {
  sessionId: string;
  message: string;
  push: boolean;
  title?: string;
  url?: string;
};

export type ProjectNotifyGuestResult = {
  sent: number;
  failed: number;
  removed: number;
};

/** PROJECT.notify — guest Web Push using TELL one-liner (Phase D). */
export async function projectNotifyGuest(
  admin: SupabaseClient,
  input: ProjectNotifyGuestInput
): Promise<ProjectNotifyGuestResult> {
  const empty = { sent: 0, failed: 0, removed: 0 };
  if (!input.push || !isPushConfigured()) return empty;

  const { data, error } = await admin
    .from("guest_push_subscriptions" as never)
    .select("id, endpoint, p256dh, auth")
    .eq("session_id", input.sessionId);

  if (error) {
    if (error.code === "42P01") {
      logger.warn("guest_push_subscriptions missing — run migration 00102");
      return empty;
    }
    logger.warn("projectNotifyGuest load failed", { error: error.message });
    return empty;
  }

  const rows = (data ?? []) as GuestPushRow[];
  if (!rows.length) return empty;

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
        title: input.title ?? "Denis",
        body: input.message,
        url: input.url,
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
