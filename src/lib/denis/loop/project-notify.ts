import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";

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
  if (!input.push) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  return notifyGuestSessionPush(admin, {
    sessionId: input.sessionId,
    pushType: "guest-denis-message",
    message: input.message,
    title: input.title,
    url: input.url,
  });
}
