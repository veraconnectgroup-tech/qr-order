"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
} from "@/lib/constants";

export type RealtimeMode = "connecting" | "live" | "polling";

type UsePostgresRealtimeOptions = {
  channelName: string;
  table: "orders" | "waiter_calls";
  filter: string;
  onChange: () => void;
  enabled?: boolean;
};

export function usePostgresRealtime({
  channelName,
  table,
  filter,
  onChange,
  enabled = true,
}: UsePostgresRealtimeOptions) {
  const [mode, setMode] = useState<RealtimeMode>("connecting");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) {
      setMode("polling");
      return;
    }

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let isLive = false;

    const supabase = createClient();

    function schedulePoll() {
      if (pollId) clearInterval(pollId);
      const intervalMs = isLive
        ? REALTIME_BACKUP_POLL_MS
        : REALTIME_FALLBACK_POLL_MS;
      pollId = setInterval(() => {
        if (!cancelled) onChangeRef.current();
      }, intervalMs);
    }

    function setLiveState(live: boolean) {
      isLive = live;
      if (!cancelled) {
        setMode(live ? "live" : "polling");
      }
      schedulePoll();
    }

    setMode("connecting");
    schedulePoll();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        () => {
          if (!cancelled) onChangeRef.current();
        }
      )
      .subscribe((status) => {
        if (cancelled) return;

        if (status === "SUBSCRIBED") {
          setLiveState(true);
          onChangeRef.current();
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setLiveState(false);
        }
      });

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, enabled]);

  return mode;
}
