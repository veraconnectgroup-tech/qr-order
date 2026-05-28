"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDenisView } from "@/lib/guest/denis-view-client";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import type { Scene } from "@/lib/scene/types";

const POLL_MS = 30_000;
const POLL_WAITING_MS = 10_000;
const SSE_FALLBACK_POLL_MS = 15_000;

export function useDenisView({
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
  const [view, setView] = useState<TableSessionView | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const lastVersionRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !sessionToken) {
      setView(null);
      setScene(null);
      return;
    }

    setLoading(true);
    try {
      const next = await fetchDenisView(tableToken, sessionToken);
      setView(next?.view ?? null);
      setScene(next?.scene ?? null);
      if (next?.view?.version != null) {
        lastVersionRef.current = next.view.version;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "View unavailable");
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionToken, tableToken]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!enabled || !sessionToken || typeof EventSource === "undefined") {
      setSseConnected(false);
      return;
    }

    const params = new URLSearchParams({
      tableToken,
      sessionToken,
    });

    const source = new EventSource(
      `/api/denis/view/stream?${params.toString()}`
    );

    source.onopen = () => setSseConnected(true);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { version?: number };
        if (
          payload.version != null &&
          payload.version !== lastVersionRef.current
        ) {
          lastVersionRef.current = payload.version;
          void refresh();
        }
      } catch {
        void refresh();
      }
    };
    source.onerror = () => {
      setSseConnected(false);
      source.close();
    };

    return () => {
      setSseConnected(false);
      source.close();
    };
  }, [enabled, sessionToken, tableToken, refresh]);

  useEffect(() => {
    if (!enabled || !sessionToken) return;
    if (sseConnected) return;

    const intervalMs = fastPoll ? POLL_WAITING_MS : POLL_MS;
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, sessionToken, refresh, fastPoll, sseConnected]);

  useEffect(() => {
    if (!enabled || !sessionToken || !sseConnected) return;
    const id = window.setInterval(() => void refresh(), SSE_FALLBACK_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, sessionToken, refresh, sseConnected]);

  return { view, scene, loading, error, refresh };
}
