"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGuestScene } from "@/lib/guest/guest-scene-client";
import type { Scene } from "@/lib/scene/types";

const POLL_MS = 30_000;

export function useGuestScene({
  tableToken,
  sessionToken,
  enabled,
  refreshKey = 0,
}: {
  tableToken: string;
  sessionToken: string | null;
  enabled: boolean;
  refreshKey?: number;
}) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !sessionToken) {
      setScene(null);
      return;
    }

    setLoading(true);
    try {
      const next = await fetchGuestScene(tableToken, sessionToken);
      setScene(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scene unavailable");
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionToken, tableToken]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!enabled || !sessionToken) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, sessionToken, refresh]);

  return { scene, loading, error, refresh };
}
