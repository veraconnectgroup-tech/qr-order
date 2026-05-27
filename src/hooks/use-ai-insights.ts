"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AiInsightsDashboardPayload,
  AiInsightsRange,
} from "@/lib/dashboard/ai-insights-data";

export function useAiInsights(initialRange: AiInsightsRange = "today") {
  const [range, setRange] = useState<AiInsightsRange>(initialRange);
  const [data, setData] = useState<AiInsightsDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/ai-insights?range=${encodeURIComponent(range)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load Denis insights.");
        setData(null);
        return;
      }
      setData(json.data as AiInsightsDashboardPayload);
    } catch {
      setError("Could not load Denis insights.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, range, setRange, refresh };
}
