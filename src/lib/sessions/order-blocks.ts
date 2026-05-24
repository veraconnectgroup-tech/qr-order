import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export type DeviceBlockRow = {
  id: string;
  blocked_until: string;
  strike_count: number;
};

export type LocationBlockPolicy = {
  rejection_ban_threshold: number;
  rejection_ban_minutes: number;
  rejection_strike_window_minutes: number;
};

const DEFAULT_POLICY: LocationBlockPolicy = {
  rejection_ban_threshold: 2,
  rejection_ban_minutes: 30,
  rejection_strike_window_minutes: 30,
};

export async function getLocationBlockPolicy(
  admin: AdminClient,
  locationId: string
): Promise<LocationBlockPolicy> {
  const { data } = await admin
    .from("locations")
    .select(
      "rejection_ban_threshold, rejection_ban_minutes, rejection_strike_window_minutes"
    )
    .eq("id", locationId)
    .single();

  if (!data) return DEFAULT_POLICY;

  const row = data as LocationBlockPolicy;
  return {
    rejection_ban_threshold: row.rejection_ban_threshold ?? 2,
    rejection_ban_minutes: row.rejection_ban_minutes ?? 30,
    rejection_strike_window_minutes: row.rejection_strike_window_minutes ?? 30,
  };
}

export async function assertDeviceNotBlocked(
  admin: AdminClient,
  tableId: string,
  deviceFingerprint: string
): Promise<{ ok: true } | { ok: false; blockedUntil: string }> {
  const block = await getActiveDeviceBlock(
    admin,
    tableId,
    deviceFingerprint
  );
  if (block) {
    return { ok: false, blockedUntil: block.blocked_until };
  }
  return { ok: true };
}

export async function getActiveDeviceBlock(
  admin: AdminClient,
  tableId: string,
  deviceFingerprint: string
): Promise<DeviceBlockRow | null> {
  const now = new Date().toISOString();

  const { data } = await admin
    .from("table_order_blocks")
    .select("id, blocked_until, strike_count")
    .eq("table_id", tableId)
    .eq("device_fingerprint", deviceFingerprint)
    .is("lifted_at", null)
    .gt("blocked_until", now)
    .order("blocked_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as DeviceBlockRow | null) ?? null;
}

async function countRecentDeviceRejects(
  admin: AdminClient,
  input: {
    tableId: string;
    deviceFingerprint: string;
    windowMinutes: number;
  }
): Promise<number> {
  const since = new Date(
    Date.now() - input.windowMinutes * 60 * 1000
  ).toISOString();

  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("table_id", input.tableId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .eq("status", "rejected")
    .eq("requires_session_open", true)
    .gte("updated_at", since);

  if (error) return 0;
  return count ?? 0;
}

/** After staff rejects access — maybe block this device on this table. */
export async function applyDeviceBlockAfterReject(
  admin: AdminClient,
  input: {
    locationId: string;
    tableId: string;
    deviceFingerprint: string | null;
  }
): Promise<{ blocked: boolean; blockedUntil?: string; strikeCount?: number }> {
  if (!input.deviceFingerprint) {
    return { blocked: false };
  }

  const policy = await getLocationBlockPolicy(admin, input.locationId);
  const strikeCount = await countRecentDeviceRejects(admin, {
    tableId: input.tableId,
    deviceFingerprint: input.deviceFingerprint,
    windowMinutes: policy.rejection_strike_window_minutes,
  });

  if (strikeCount < policy.rejection_ban_threshold) {
    return { blocked: false, strikeCount };
  }

  const blockedUntil = new Date(
    Date.now() + policy.rejection_ban_minutes * 60 * 1000
  ).toISOString();

  const now = new Date().toISOString();

  await admin
    .from("table_order_blocks")
    .update({ lifted_at: now })
    .eq("table_id", input.tableId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .is("lifted_at", null);

  await admin.from("table_order_blocks").insert({
    location_id: input.locationId,
    table_id: input.tableId,
    device_fingerprint: input.deviceFingerprint,
    blocked_until: blockedUntil,
    strike_count: strikeCount,
  });

  return { blocked: true, blockedUntil, strikeCount };
}

export async function liftDeviceBlock(
  admin: AdminClient,
  input: {
    tableId: string;
    deviceFingerprint: string;
    staffId: string;
  }
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("table_order_blocks")
    .update({
      lifted_at: now,
      lifted_by_staff_id: input.staffId,
    })
    .eq("table_id", input.tableId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .is("lifted_at", null)
    .gt("blocked_until", now)
    .select("id")
    .maybeSingle();

  return Boolean(data);
}
