"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardFloorGraphPayload } from "@/lib/denis/venue/floor/load-dashboard-floor-graph";

const POLL_MS = 30_000;

export function useFloorGraph() {
  const [data, setData] = useState<DashboardFloorGraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/floor-graph");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load floor graph.");
        setData(null);
        return;
      }
      setData(json.data as DashboardFloorGraphPayload);
    } catch {
      setError("Could not load floor graph.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, loading, error, refresh };
}
