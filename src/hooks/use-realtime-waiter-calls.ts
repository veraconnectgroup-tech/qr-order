"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    .select("id, name, zone:zones(name)")
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .in("id", tableIds);

  const tableMap = new Map(
    (tablesData ?? []).map((t) => [
      (t as { id: string }).id,
      t as unknown as { name: string; zone: { name: string } | null },
    ])
  );

  return calls.map((call) => ({
    ...call,
    tables: tableMap.get(call.table_id) ?? null,
  }));
}

export function useRealtimeWaiterCalls(locationId: string) {
  const [calls, setCalls] = useState<WaiterCallWithTable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    const supabase = createClient();

    const { data: active } = await supabase
      .from("waiter_calls")
      .select("*")
      .eq("location_id", locationId)
      .in("status", ["pending", "acknowledged"])
      .order("created_at", { ascending: false });

    const { data: resolved } = await supabase
      .from("waiter_calls")
      .select("*")
      .eq("location_id", locationId)
      .eq("status", "resolved")
      .gte("created_at", startOfTodayIso())
      .order("created_at", { ascending: false });

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
    filter: `location_id=eq.${locationId}`,
    onChange: fetchCalls,
    enabled: Boolean(locationId),
  });

  return { calls, loading, realtimeMode };
}
