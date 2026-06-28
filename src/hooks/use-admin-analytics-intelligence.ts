"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AdminIntelligenceSnapshot } from "@/lib/analytics/admin-intelligence/types";

export function useAdminAnalyticsIntelligence(
  initial?: AdminIntelligenceSnapshot | null
) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(!initial);
  const [snapshot, setSnapshot] = useState<AdminIntelligenceSnapshot | null>(
    initial ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = searchParams.toString();
      const response = await fetch(
        `/api/admin/analytics/intelligence${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const body = (await response.json()) as {
        error?: string;
        snapshot?: AdminIntelligenceSnapshot;
      };
      if (!response.ok) {
        setError(body.error ?? "Failed to load intelligence");
        return;
      }
      setSnapshot(body.snapshot ?? null);
    } catch {
      setError("Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (initial) return;
    void refresh();
  }, [refresh, initial]);

  return { loading, snapshot, error, refresh };
}
