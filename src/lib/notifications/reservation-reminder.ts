import type { SupabaseClient } from "@supabase/supabase-js";
import { routeGuestNotification } from "@/lib/notifications/channel-router";
import {
  buildReservationReminderMessage,
  shouldSendReservationReminder,
} from "@/lib/notifications/templates";

export type ReservationReminder = {
  id: string;
  guestName: string;
  phoneE164: string;
  deviceFingerprint: string;
  scheduledAt: string;
  reminderSentAt?: string | null;
};

/** Send 2h-before reservation reminders via channel router (Prompt 89). */
export async function sendDueReservationReminders(
  admin: SupabaseClient,
  input: {
    locationId: string;
    reservations: ReservationReminder[];
    language?: string;
    nowMs?: number;
  }
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const reservation of input.reservations) {
    if (reservation.reminderSentAt) {
      skipped += 1;
      continue;
    }
    if (
      !shouldSendReservationReminder({
        scheduledAt: reservation.scheduledAt,
        nowMs: input.nowMs,
      })
    ) {
      skipped += 1;
      continue;
    }

    const message = buildReservationReminderMessage({
      scheduledAt: reservation.scheduledAt,
      language: input.language,
    });

    const result = await routeGuestNotification(admin, {
      locationId: input.locationId,
      deviceFingerprint: reservation.deviceFingerprint,
      kind: "transactional",
      templateId: "reservation.reminder_2h",
      message,
      title: "Podsjetnik rezervacije",
      phone: reservation.phoneE164,
      pushAvailable: false,
    });

    if (result.sentVia) sent += 1;
    else skipped += 1;
  }

  return { sent, skipped };
}
