"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GUEST_VIEW_FALLBACK_POLL_MS,
  REALTIME_SSE_RECONNECT_MAX_MS,
  REALTIME_SSE_RECONNECT_MS,
} from "@/lib/constants";
import { fetchDenisView } from "@/lib/guest/denis-view-client";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import { tableSessionViewToScene } from "@/lib/denis/loop/view-to-scene";
import type { Scene } from "@/lib/scene/types";

const SSE_RECONNECT_MS = REALTIME_SSE_RECONNECT_MS;

export function useDenisView({
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
  const [view, setView] = useState<TableSessionView | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const lastVersionRef = useRef<number | null>(null);
  // Concurrent SSE version bumps (e.g. guest message + Denis reply landing
  // within milliseconds) can each trigger their own refresh(); the fetches
  // are not guaranteed to resolve in the order they were issued. Without a
  // sequence guard, a straggling response for an older snapshot can land
  // after a newer one and overwrite it, making recent messages vanish from
  // the transcript.
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled || !sessionToken) {
      setView(null);
      setScene(null);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const next = await fetchDenisView(tableToken, sessionToken);
      if (seq !== requestSeqRef.current) return;
      const nextView = next?.view ?? null;
      setView(nextView);
      setScene(
        nextView
          ? tableSessionViewToScene(nextView, nextView.accessibility)
          : null
      );
      if (next?.view?.version != null) {
        lastVersionRef.current = next.view.version;
      }
      setError(null);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof Error ? err.message : "View unavailable");
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
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

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let reconnectAttempts = 0;

    const handleVersionMessage = (event: MessageEvent<string>) => {
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

    const connect = () => {
      if (disposed) return;

      const params = new URLSearchParams({
        tableToken,
        sessionToken,
      });

      source = new EventSource(
        `/api/denis/view/stream?${params.toString()}`
      );

      source.onopen = () => {
        reconnectAttempts = 0;
        setSseConnected(true);
      };
      source.onmessage = handleVersionMessage;
      source.onerror = () => {
        setSseConnected(false);
        source?.close();
        source = null;
        if (!disposed) {
          const delay = Math.min(
            SSE_RECONNECT_MS * 2 ** reconnectAttempts,
            REALTIME_SSE_RECONNECT_MAX_MS
          );
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
      }
      source?.close();
      setSseConnected(false);
    };
  }, [enabled, sessionToken, tableToken, refresh]);

  useEffect(() => {
    if (!enabled || !sessionToken || sseConnected) return;

    const id = window.setInterval(
      () => void refresh(),
      GUEST_VIEW_FALLBACK_POLL_MS
    );
    return () => window.clearInterval(id);
  }, [enabled, sessionToken, refresh, sseConnected]);

  return {
    view,
    scene,
    loading,
    error,
    refresh,
    connectionMode: sseConnected ? ("live" as const) : ("polling" as const),
    sseConnected,
  };
}
