import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/push/vapid";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh?: string | null;
  auth?: string | null;
  keys_p256dh?: string | null;
  keys_auth?: string | null;
};

export type NotifyLocationResult = {
  sent: number;
  failed: number;
  removed: number;
};

function subscriptionKeys(row: PushSubscriptionRow) {
  const p256dh = row.p256dh ?? row.keys_p256dh;
  const auth = row.auth ?? row.keys_auth;
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

export async function notifyLocationPush(
  locationId: string,
  payload: PushPayload
): Promise<NotifyLocationResult> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const admin = createAdminClient();
  type PushAdmin = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string
        ) => PromiseLike<{ data: PushSubscriptionRow[] | null; error: unknown }>;
      };
      delete: () => {
        eq: (
          col: string,
          val: string
        ) => PromiseLike<{ error: unknown }>;
      };
    };
  };
  const pushAdmin = admin as unknown as PushAdmin;

  const { data, error } = await pushAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, keys_p256dh, keys_auth")
    .eq("location_id", locationId);

  if (error || !data?.length) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of data) {
    const keys = subscriptionKeys(row);
    if (!keys) {
      failed += 1;
      continue;
    }

    const result = await sendPush(
      {
        endpoint: row.endpoint,
        keys,
      },
      payload
    );

    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;

    if (result.expired) {
      const { error: deleteError } = await pushAdmin
        .from("push_subscriptions")
        .delete()
        .eq("id", row.id);

      if (!deleteError) {
        removed += 1;
      }
    }
  }

  return { sent, failed, removed };
}
