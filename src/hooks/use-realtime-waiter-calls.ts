"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_POLL_INTERVAL_MS } from "@/lib/constants";
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

  useEffect(() => {
    const supabase = createClient();

    const fetchCalls = async () => {
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
    };

    fetchCalls();

    const channel = supabase
      .channel(`waiter-calls:${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiter_calls",
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          fetchCalls();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchCalls();
        }
      });

    const pollId = setInterval(fetchCalls, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [locationId]);

  return { calls, loading };
}
