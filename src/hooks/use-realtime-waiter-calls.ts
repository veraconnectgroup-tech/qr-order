"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  parseWaiterCallTableRows,
  WAITER_CALL_TABLE_SELECT,
} from "@/lib/supabase/query-rows";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { WaiterCall } from "@/types";

export type WaiterCallWithTable = WaiterCall & {
  tables: { name: string; zone: { name: string } | null } | null;
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function enrichCalls(
  calls: WaiterCall[],
  locationId: string
): Promise<WaiterCallWithTable[]> {
  if (calls.length === 0) return [];

  const supabase = createClient();
  const tableIds = [...new Set(calls.map((c) => c.table_id))];

  const { data: tablesData } = await supabase
    .from("tables")
    .select(WAITER_CALL_TABLE_SELECT)
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .in("id", tableIds);

  const tableMap = new Map(
    parseWaiterCallTableRows(tablesData).map((t) => [t.id, t])
  );

  return calls.map((call) => ({
    ...call,
    tables: tableMap.get(call.table_id) ?? null,
  }));
}

export function useRealtimeWaiterCalls(locationId: string) {
  const [calls, setCalls] = useState<WaiterCallWithTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    const supabase = createClient();

    const [{ data: active, error: activeError }, { data: resolved, error: resolvedError }] =
      await Promise.all([
        supabase
          .from("waiter_calls")
          .select("*")
          .eq("location_id", locationId)
          .in("status", ["pending", "acknowledged"])
          .order("created_at", { ascending: false }),
        supabase
          .from("waiter_calls")
          .select("*")
          .eq("location_id", locationId)
          .eq("status", "resolved")
          .gte("created_at", startOfTodayIso())
          .order("created_at", { ascending: false }),
      ]);

    if (activeError || resolvedError) {
      setError(activeError?.message ?? resolvedError?.message ?? "Failed to load calls");
      setLoading(false);
      return;
    }

    setError(null);
    const merged = [
      ...((active as WaiterCall[]) ?? []),
      ...((resolved as WaiterCall[]) ?? []),
    ];

    setCalls(await enrichCalls(merged, locationId));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchCalls();
  }, [locationId, fetchCalls]);

  const realtimeMode = usePostgresRealtime({
    channelName: `waiter-calls:${locationId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchCalls,
    enabled: Boolean(locationId),
  });

  return { calls, loading, error, realtimeMode, refetch: fetchCalls };
}
