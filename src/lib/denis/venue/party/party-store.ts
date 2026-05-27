import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PartyDeviceRow,
  PartyMode,
  RegisterPartyDeviceResult,
  TablePartyModel,
} from "@/lib/denis/venue/party/types";

type TableSessionRow = {
  id: string;
  denis_shared_ai_session_id: string | null;
};

type PartyDeviceDbRow = {
  device_fingerprint: string;
  ai_session_id: string | null;
  display_name: string | null;
  is_primary: boolean;
  manual_cart_snapshot: unknown;
  manual_cart_revision: number;
  last_active_at: string;
};

function mapDeviceRow(row: PartyDeviceDbRow): PartyDeviceRow {
  return {
    deviceFingerprint: row.device_fingerprint,
    aiSessionId: row.ai_session_id,
    displayName: row.display_name,
    isPrimary: row.is_primary,
    manualCartRevision: row.manual_cart_revision,
    manualCartSnapshot: row.manual_cart_snapshot,
    lastActiveAt: row.last_active_at,
  };
}

export async function resolveActiveTableSessionId(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    sessionToken: string;
  }
): Promise<string | null> {
  const maxAgeMs = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const sessionCutoff = new Date(Date.now() - maxAgeMs).toISOString();

  const { data } = await admin
    .from("table_sessions")
    .select("id")
    .eq("session_token", input.sessionToken)
    .eq("table_id", input.tableId)
    .eq("location_id", input.locationId)
    .eq("status", "active")
    .gte("opened_at", sessionCutoff)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

export async function loadTableParty(
  admin: SupabaseClient,
  input: {
    tableSessionId: string;
    partyMode: PartyMode;
    deviceFingerprint?: string | null;
  }
): Promise<TablePartyModel | null> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("id, denis_shared_ai_session_id")
    .eq("id", input.tableSessionId)
    .maybeSingle();

  const session = sessionRow as TableSessionRow | null;
  if (!session) return null;

  const { data: deviceRows } = await admin
    .from("denis_party_devices")
    .select(
      "device_fingerprint, ai_session_id, display_name, is_primary, manual_cart_snapshot, manual_cart_revision, last_active_at"
    )
    .eq("table_session_id", input.tableSessionId)
    .order("last_active_at", { ascending: false });

  const devices = ((deviceRows ?? []) as PartyDeviceDbRow[]).map(mapDeviceRow);
  const fingerprint = input.deviceFingerprint?.trim() ?? null;
  const current = fingerprint
    ? devices.find(
        (device) =>
          device.deviceFingerprint.toLowerCase() === fingerprint.toLowerCase()
      )
    : undefined;

  return {
    tableSessionId: session.id,
    partyMode: input.partyMode,
    sharedAiSessionId: session.denis_shared_ai_session_id,
    devices,
    activeDeviceCount: devices.length,
    currentDeviceFingerprint: fingerprint,
    isCurrentDevicePrimary: current?.isPrimary ?? false,
  };
}

export async function registerPartyDevice(
  admin: SupabaseClient,
  input: {
    tableSessionId: string;
    locationId: string;
    tableId: string;
    deviceFingerprint: string;
    aiSessionId?: string | null;
    manualCartSnapshot?: unknown;
    manualCartRevision?: number;
  }
): Promise<RegisterPartyDeviceResult | null> {
  const { data, error } = await admin.rpc("upsert_denis_party_device", {
    p_table_session_id: input.tableSessionId,
    p_location_id: input.locationId,
    p_table_id: input.tableId,
    p_device_fingerprint: input.deviceFingerprint,
    p_ai_session_id: input.aiSessionId ?? null,
    p_manual_cart_snapshot: input.manualCartSnapshot ?? null,
    p_manual_cart_revision: input.manualCartRevision ?? 0,
  });

  if (error || !data || typeof data !== "object") return null;

  const row = data as {
    device_id?: string;
    is_primary?: boolean;
    shared_ai_session_id?: string | null;
  };

  if (!row.device_id) return null;

  return {
    deviceId: row.device_id,
    isPrimary: row.is_primary ?? false,
    sharedAiSessionId: row.shared_ai_session_id ?? null,
  };
}
