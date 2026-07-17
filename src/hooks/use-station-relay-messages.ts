"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { DenisStationRelayMessageRow } from "@/lib/denis/stations/station-relay-messages";

/**
 * Two directions for one station: incoming relay messages to answer
 * (someone at the other station asked something), and replies to deliver
 * back (this station asked something earlier, the other station answered).
 * Mirrors use-station-questions.ts's fetch/realtime shape.
 */
export function useStationRelayMessages(
  locationId: string,
  station: "kitchen" | "bar"
) {
  const [incoming, setIncoming] = useState<DenisStationRelayMessageRow[]>([]);
  const [undeliveredReplies, setUndeliveredReplies] = useState<
    DenisStationRelayMessageRow[]
  >([]);
  const [expiredUnanswered, setExpiredUnanswered] = useState<
    DenisStationRelayMessageRow[]
  >([]);

  const fetchIncoming = useCallback(async () => {
    if (!locationId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("denis_station_relay_messages")
      .select("*")
      .eq("location_id", locationId)
      .eq("to_station", station)
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("asked_at", { ascending: true });

    if (error) {
      console.error("Relay messages fetch failed:", error.message);
      return;
    }
    setIncoming((data ?? []) as DenisStationRelayMessageRow[]);
  }, [locationId, station]);

  const fetchUndeliveredReplies = useCallback(async () => {
    if (!locationId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("denis_station_relay_messages")
      .select("*")
      .eq("location_id", locationId)
      .eq("from_station", station)
      .eq("status", "answered")
      .is("origin_notified_at", null)
      .order("replied_at", { ascending: true });

    if (error) {
      console.error("Relay replies fetch failed:", error.message);
      return;
    }
    setUndeliveredReplies((data ?? []) as DenisStationRelayMessageRow[]);
  }, [locationId, station]);

  /** Own asks that nobody answered before expires_at — otherwise a silent failure (row just drops out of the "open" queries forever). */
  const fetchExpiredUnanswered = useCallback(async () => {
    if (!locationId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("denis_station_relay_messages")
      .select("*")
      .eq("location_id", locationId)
      .eq("from_station", station)
      .eq("status", "open")
      .lte("expires_at", new Date().toISOString())
      .order("asked_at", { ascending: true });

    if (error) {
      console.error("Relay expired fetch failed:", error.message);
      return;
    }
    setExpiredUnanswered((data ?? []) as DenisStationRelayMessageRow[]);
  }, [locationId, station]);

  const refetch = useCallback(() => {
    void fetchIncoming();
    void fetchUndeliveredReplies();
    void fetchExpiredUnanswered();
  }, [fetchIncoming, fetchUndeliveredReplies, fetchExpiredUnanswered]);

  useEffect(() => {
    if (!locationId) return;
    refetch();
  }, [locationId, refetch]);

  usePostgresRealtime({
    channelName: `station-relay:${locationId}:${station}`,
    table: "denis_station_relay_messages",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refetch,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  const answerRelay = useCallback(
    async (relayId: string, reply: string) => {
      setIncoming((prev) => prev.filter((row) => row.id !== relayId));
      const res = await fetch(`/api/denis/station-relay/${relayId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      if (!res.ok && res.status !== 409) {
        await fetchIncoming();
        throw new Error("Relay answer failed");
      }
    },
    [fetchIncoming]
  );

  const acknowledgeDelivery = useCallback(
    async (relayId: string) => {
      setUndeliveredReplies((prev) => prev.filter((row) => row.id !== relayId));
      await fetch(`/api/denis/station-relay/${relayId}/acknowledge`, {
        method: "POST",
      }).catch(() => {
        // Best-effort — worst case it gets spoken again next poll.
      });
    },
    []
  );

  const dismissExpired = useCallback(
    async (relayId: string) => {
      setExpiredUnanswered((prev) => prev.filter((row) => row.id !== relayId));
      await fetch(`/api/denis/station-relay/${relayId}/expire`, {
        method: "POST",
      }).catch(() => {
        // Best-effort — worst case it gets spoken again next poll.
      });
    },
    []
  );

  return {
    incoming,
    undeliveredReplies,
    expiredUnanswered,
    answerRelay,
    acknowledgeDelivery,
    dismissExpired,
    refetch,
  };
}
