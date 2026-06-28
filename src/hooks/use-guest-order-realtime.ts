"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REALTIME_FALLBACK_POLL_MS,
  REALTIME_SSE_RECONNECT_MS,
} from "@/lib/constants";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

type GuestOrderStreamPayload = Record<string, unknown>;

type UseGuestOrderRealtimeOptions<T extends GuestOrderStreamPayload> = {
  orderId: string;
  sessionToken: string;
  enabled?: boolean;
  parseOrder: (payload: GuestOrderStreamPayload) => T | null;
  fetchOrder: () => Promise<T | null>;
  shouldStop?: (order: T) => boolean;
};

/** Guest order tracking — SSE stream with polling fallback (Prompt 76). */
export function useGuestOrderRealtime<T extends GuestOrderStreamPayload>({
  orderId,
  sessionToken,
  enabled = true,
  parseOrder,
  fetchOrder,
  shouldStop,
}: UseGuestOrderRealtimeOptions<T>) {
  const [order, setOrder] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<RealtimeMode>("connecting");
  const shouldStopRef = useRef(shouldStop);
  shouldStopRef.current = shouldStop;

  const refresh = useCallback(async () => {
    const next = await fetchOrder();
    if (next) setOrder(next);
    return next;
  }, [fetchOrder]);

  useEffect(() => {
    if (!enabled || !orderId || !sessionToken) {
      setMode("polling");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const stopPolling = () => {
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    const startPolling = () => {
      if (pollId) return;
      pollId = setInterval(() => {
        void refresh().then((next) => {
          if (next && shouldStopRef.current?.(next)) {
            stopPolling();
          }
        });
      }, REALTIME_FALLBACK_POLL_MS);
    };

    const applyPayload = (payload: GuestOrderStreamPayload) => {
      const parsed = parseOrder(payload);
      if (!parsed) return;
      setOrder(parsed);
      if (shouldStopRef.current?.(parsed)) {
        stopPolling();
      }
    };

    const connect = () => {
      if (cancelled) return;

      const params = new URLSearchParams({ sessionToken });
      source = new EventSource(
        `/api/orders/${orderId}/stream?${params.toString()}`
      );

      source.onopen = () => {
        setMode("live");
        stopPolling();
      };

      source.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as GuestOrderStreamPayload);
        } catch {
          void refresh();
        }
      };

      source.onerror = () => {
        setMode("polling");
        source?.close();
        source = null;
        startPolling();
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, REALTIME_SSE_RECONNECT_MS);
        }
      };
    };

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setOrder(null);
      }
    });

    void refresh().then(() => {
      if (!cancelled) setLoading(false);
    });

    setMode("connecting");
    connect();

    return () => {
      cancelled = true;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [enabled, fetchOrder, orderId, parseOrder, refresh, sessionToken]);

  return { order, loading, mode, refresh };
}
