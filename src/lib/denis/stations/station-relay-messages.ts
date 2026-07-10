import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logger";

export type DenisStationRelayMessageRow =
  Database["public"]["Tables"]["denis_station_relay_messages"]["Row"];

export type RelayStation = "kitchen" | "bar";

const RELAY_EXPIRY_MS = 20 * 60_000;

export type CreateRelayMessageResult =
  | { created: true; relay: DenisStationRelayMessageRow }
  | { created: false; reason: "insert_failed" };

/**
 * Denis relaying a free-text message between kitchen and bar — voice
 * initiated, either because staff asked him to ("idi pitaj bar...") or
 * because he judged mid-conversation that the other station should know
 * something. Distinct from station_questions: that table is order-status
 * specific (strict answer enum, tied to an order_id); this is a general
 * message + free-text reply, so it gets its own lightweight table.
 */
export async function createRelayMessage(
  admin: SupabaseClient,
  input: {
    locationId: string;
    fromStation: RelayStation;
    toStation: RelayStation;
    message: string;
    requestedByStaffId: string | null;
  }
): Promise<CreateRelayMessageResult> {
  const expiresAt = new Date(Date.now() + RELAY_EXPIRY_MS).toISOString();

  const { data: inserted, error } = await admin
    .from("denis_station_relay_messages")
    .insert({
      location_id: input.locationId,
      from_station: input.fromStation,
      to_station: input.toStation,
      message: input.message,
      requested_by: input.requestedByStaffId,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    logger.warn("createRelayMessage insert failed", {
      locationId: input.locationId,
      fromStation: input.fromStation,
      toStation: input.toStation,
      error: error?.message,
    });
    return { created: false, reason: "insert_failed" };
  }

  const relay = inserted as DenisStationRelayMessageRow;

  return { created: true, relay };
}

export type AnswerRelayMessageResult =
  | { ok: true; relay: DenisStationRelayMessageRow }
  | { ok: false; error: "not_open" | "update_failed" };

export async function answerRelayMessage(
  admin: SupabaseClient,
  input: { relayId: string; reply: string; repliedByStaffId: string | null }
): Promise<AnswerRelayMessageResult> {
  const { data: existing } = await admin
    .from("denis_station_relay_messages")
    .select("id, status")
    .eq("id", input.relayId)
    .maybeSingle();

  if (!existing || (existing as { status: string }).status !== "open") {
    return { ok: false, error: "not_open" };
  }

  const { data: updated, error } = await admin
    .from("denis_station_relay_messages")
    .update({
      status: "answered",
      reply: input.reply,
      replied_by: input.repliedByStaffId,
      replied_at: new Date().toISOString(),
    })
    .eq("id", input.relayId)
    .eq("status", "open")
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, error: "update_failed" };
  }

  const relay = updated as DenisStationRelayMessageRow;

  return { ok: true, relay };
}

/** Marks the reply as delivered back to the asking station — called once its auto-speak has fired, so it never speaks twice. */
export async function acknowledgeRelayDelivery(
  admin: SupabaseClient,
  input: { relayId: string }
): Promise<boolean> {
  const { error } = await admin
    .from("denis_station_relay_messages")
    .update({ origin_notified_at: new Date().toISOString() })
    .eq("id", input.relayId)
    .is("origin_notified_at", null);

  return !error;
}

export async function listOpenRelayMessagesForStation(
  admin: SupabaseClient,
  input: { locationId: string; station: RelayStation }
): Promise<DenisStationRelayMessageRow[]> {
  const { data, error } = await admin
    .from("denis_station_relay_messages")
    .select("*")
    .eq("location_id", input.locationId)
    .eq("to_station", input.station)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("asked_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as DenisStationRelayMessageRow[];
}

/** Answered replies not yet spoken back to the station that originally asked. */
export async function listUndeliveredRepliesForStation(
  admin: SupabaseClient,
  input: { locationId: string; station: RelayStation }
): Promise<DenisStationRelayMessageRow[]> {
  const { data, error } = await admin
    .from("denis_station_relay_messages")
    .select("*")
    .eq("location_id", input.locationId)
    .eq("from_station", input.station)
    .eq("status", "answered")
    .is("origin_notified_at", null)
    .order("replied_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as DenisStationRelayMessageRow[];
}
