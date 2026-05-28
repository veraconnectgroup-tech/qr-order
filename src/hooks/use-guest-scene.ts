"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGuestScene } from "@/lib/guest/guest-scene-client";
import type { Scene } from "@/lib/scene/types";

const POLL_MS = 30_000;
const POLL_WAITING_MS = 10_000;

export function useGuestScene({
  tableToken,
  sessionToken,
  enabled,
  refreshKey = 0,
  fastPoll = false,
}: {
  tableToken: string;
  sessionToken: string | null;
  enabled: boolean;
  refreshKey?: number;
  fastPoll?: boolean;
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
    const intervalMs = fastPoll ? POLL_WAITING_MS : POLL_MS;
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, sessionToken, refresh, fastPoll]);

  return { scene, loading, error, refresh };
}
