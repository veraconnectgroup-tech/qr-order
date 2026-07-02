"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { TableBusObligationRow } from "@/lib/denis/cognition/waiter/bus-table-obligation";

export type TableBusObligationClientRow = TableBusObligationRow & {
  tables?: { name: string | null } | null;
};

export function useTableBusObligation(tableId: string | null) {
  const [obligation, setObligation] = useState<TableBusObligationClientRow | null>(
    null
  );
  const [loading, setLoading] = useState(Boolean(tableId));

  const refetch = useCallback(async () => {
    if (!tableId) {
      setObligation(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("table_bus_obligations")
      .select("*, tables(name)")
      .eq("table_id", tableId)
      .eq("status", "open")
      .maybeSingle();

    if (error) {
      console.error("Table bus obligation fetch failed:", error.message);
      setLoading(false);
      return;
    }

    setObligation((data as TableBusObligationClientRow | null) ?? null);
    setLoading(false);
  }, [tableId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  usePostgresRealtime({
    channelName: `table-bus:${tableId ?? "idle"}`,
    table: "table_bus_obligations",
    filter: tableId ? `table_id=eq.${tableId}` : "id=eq.00000000-0000-0000-0000-000000000000",
    onChange: refetch,
    enabled: Boolean(tableId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return { obligation, loading, refetch };
}

export function useLocationBusObligations(locationId: string | null) {
  const [rows, setRows] = useState<TableBusObligationClientRow[]>([]);
  const [loading, setLoading] = useState(Boolean(locationId));

  const refetch = useCallback(async () => {
    if (!locationId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("table_bus_obligations")
      .select("*, tables(name)")
      .eq("location_id", locationId)
      .eq("status", "open")
      .order("paid_at", { ascending: true });

    if (error) {
      console.error("Location bus obligations fetch failed:", error.message);
      setLoading(false);
      return;
    }

    setRows((data as TableBusObligationClientRow[] | null) ?? []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  usePostgresRealtime({
    channelName: `location-bus:${locationId ?? "idle"}`,
    table: "table_bus_obligations",
    locationId: locationId ?? undefined,
    filter: locationId
      ? `location_id=eq.${locationId}`
      : "id=eq.00000000-0000-0000-0000-000000000000",
    onChange: refetch,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return { rows, loading, refetch };
}
