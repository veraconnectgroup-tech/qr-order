"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { MissionRow } from "@/lib/denis/missions/mission-types";

/**
 * Same shape as use-table-bus-obligations.ts's useTableBusObligation — the
 * waiter-facing surface denis_missions was missing entirely (missions got
 * created and escalated but nothing ever showed them to staff or let
 * anyone mark one done).
 */
export function useTableMission(tableId: string | null) {
  const [mission, setMission] = useState<MissionRow | null>(null);
  const [loading, setLoading] = useState(Boolean(tableId));

  const refetch = useCallback(async () => {
    if (!tableId) {
      setMission(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("denis_missions")
      .select("*")
      .eq("table_id", tableId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Table mission fetch failed:", error.message);
      setLoading(false);
      return;
    }

    setMission((data as MissionRow | null) ?? null);
    setLoading(false);
  }, [tableId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  usePostgresRealtime({
    channelName: `table-mission:${tableId ?? "idle"}`,
    table: "denis_missions",
    filter: tableId ? `table_id=eq.${tableId}` : "id=eq.00000000-0000-0000-0000-000000000000",
    onChange: refetch,
    enabled: Boolean(tableId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return { mission, loading, refetch };
}
