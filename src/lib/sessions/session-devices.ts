import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTablePin, hashTablePin } from "@/lib/sessions/table-pin";

type AdminClient = SupabaseClient;

export type ActiveSessionRow = {
  id: string;
  session_token: string;
  table_id: string;
  location_id: string;
  status: string;
  bill_status: string;
  order_pin_hash: string | null;
  opened_at: string;
};

export async function getActiveTableSession(
  admin: AdminClient,
  tableId: string
): Promise<ActiveSessionRow | null> {
  const { data } = await admin
    .from("table_sessions")
    .select(
      "id, session_token, table_id, location_id, status, bill_status, order_pin_hash, opened_at"
    )
    .eq("table_id", tableId)
    .eq("status", "active")
    .eq("bill_status", "open")
    .maybeSingle();

  return (data as ActiveSessionRow | null) ?? null;
}

export async function getPendingApprovalOrder(
  admin: AdminClient,
  tableId: string
) {
  const { data } = await admin
    .from("orders")
    .select("id, order_number, total, created_at, device_fingerprint")
    .eq("table_id", tableId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as {
    id: string;
    order_number: number;
    total: number;
    created_at: string;
    device_fingerprint: string | null;
  } | null;
}

export async function trustSessionDevice(
  admin: AdminClient,
  input: {
    sessionId: string;
    deviceFingerprint: string;
    userAgent?: string | null;
  }
): Promise<{ deviceToken: string }> {
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("session_devices")
    .select("id, device_token")
    .eq("session_id", input.sessionId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; device_token: string };
    await admin
      .from("session_devices")
      .update({
        revoked_at: null,
        pin_verified_at: now,
        last_seen_at: now,
        user_agent: input.userAgent ?? null,
      })
      .eq("id", row.id);
    return { deviceToken: row.device_token };
  }

  const { data: created, error } = await admin
    .from("session_devices")
    .insert({
      session_id: input.sessionId,
      device_fingerprint: input.deviceFingerprint,
      user_agent: input.userAgent ?? null,
    })
    .select("device_token")
    .single();

  if (error || !created) {
    throw new Error("Device trust could not be recorded.");
  }

  return { deviceToken: (created as { device_token: string }).device_token };
}

export async function isTrustedDevice(
  admin: AdminClient,
  input: {
    sessionId: string;
    deviceToken: string;
    deviceFingerprint: string;
  }
): Promise<boolean> {
  const { data: session } = await admin
    .from("table_sessions")
    .select("status, bill_status")
    .eq("id", input.sessionId)
    .single();

  const sessionRow = session as {
    status: string;
    bill_status: string;
  } | null;

  if (
    !sessionRow ||
    sessionRow.status !== "active" ||
    sessionRow.bill_status !== "open"
  ) {
    return false;
  }

  const { data: device } = await admin
    .from("session_devices")
    .select("id, device_fingerprint, revoked_at")
    .eq("session_id", input.sessionId)
    .eq("device_token", input.deviceToken)
    .is("revoked_at", null)
    .maybeSingle();

  if (!device) return false;

  const deviceRow = device as {
    device_fingerprint: string;
  };

  return deviceRow.device_fingerprint === input.deviceFingerprint;
}

export async function revokeSessionDevices(
  admin: AdminClient,
  sessionId: string
) {
  await admin
    .from("session_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("revoked_at", null);
}

export async function createActiveSessionWithPin(
  admin: AdminClient,
  input: {
    tableId: string;
    locationId: string;
    approvedByStaffId?: string | null;
  }
): Promise<
  | { sessionId: string; sessionToken: string; pinPlain: string }
  | { error: string; status: number }
> {
  const existing = await getActiveTableSession(admin, input.tableId);
  if (existing) {
    return {
      sessionId: existing.id,
      sessionToken: existing.session_token,
      pinPlain: "",
    };
  }

  const pinPlain = generateTablePin();
  const orderPinHash = hashTablePin(pinPlain);

  const { data: session, error } = await admin
    .from("table_sessions")
    .insert({
      table_id: input.tableId,
      location_id: input.locationId,
      status: "active",
      bill_status: "open",
      order_pin_hash: orderPinHash,
      order_pin_set_at: new Date().toISOString(),
      approved_by_staff_id: input.approvedByStaffId ?? null,
    })
    .select("id, session_token")
    .single();

  if (error || !session) {
    if (error?.code === "23505") {
      const raced = await getActiveTableSession(admin, input.tableId);
      if (raced) {
        return {
          sessionId: raced.id,
          sessionToken: raced.session_token,
          pinPlain: "",
        };
      }
    }
    return { error: "Session could not be created.", status: 500 };
  }

  const row = session as { id: string; session_token: string };
  return {
    sessionId: row.id,
    sessionToken: row.session_token,
    pinPlain,
  };
}

export async function closeTableSession(
  admin: AdminClient,
  sessionId: string,
  billStatus: "settled" | "void" = "settled"
) {
  const now = new Date().toISOString();
  await admin
    .from("table_sessions")
    .update({
      status: "closed",
      closed_at: now,
      bill_status: billStatus,
      order_pin_hash: null,
    })
    .eq("id", sessionId);

  await revokeSessionDevices(admin, sessionId);
}
