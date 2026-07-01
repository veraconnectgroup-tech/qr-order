import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPushConfigured,
  sendPush,
  type PushPayload,
} from "@/lib/push/vapid";

export type NotifyLocationOptions = {
  /** When set and not broadcasting, only this staff member receives the push. */
  assignedStaffId?: string | null;
  /** Urgent / allergy — ignore assigned filter and notify everyone. */
  broadcast?: boolean;
};

export type NotifyLocationResult = {
  sent: number;
  failed: number;
  removed: number;
  targeted: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  staff_id: string | null;
};

export async function notifyLocationPush(
  locationId: string,
  payload: PushPayload,
  options: NotifyLocationOptions = {}
): Promise<NotifyLocationResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0, targeted: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, staff_id")
    .eq("location_id", locationId);

  if (error || !data?.length) {
    return { sent: 0, failed: 0, removed: 0, targeted: 0 };
  }

  const broadcast = options.broadcast ?? Boolean(payload.urgent);

  const rows = (data as PushSubscriptionRow[]).filter((row) => {
    if (broadcast) return true;
    if (!options.assignedStaffId) return true;
    return row.staff_id === options.assignedStaffId;
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of rows) {
    if (!row.p256dh || !row.auth) {
      failed += 1;
      continue;
    }

    const result = await sendPush(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      payload
    );

    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;

    if (result.expired) {
      const { error: deleteError } = await admin
        .from("push_subscriptions")
        .delete()
        .eq("id", row.id);

      if (!deleteError) {
        removed += 1;
      }
    }
  }

  return { sent, failed, removed, targeted: rows.length };
}
