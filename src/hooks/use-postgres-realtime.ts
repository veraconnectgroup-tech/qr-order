"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
} from "@/lib/constants";

export type RealtimeMode = "connecting" | "live" | "polling";

type RealtimeTable = "orders" | "waiter_calls";

type UsePostgresRealtimeOptions = {
  channelName: string;
  table: RealtimeTable;
  locationId: string;
  filter: string;
  onChange: () => void;
  enabled?: boolean;
  fallbackPollMs?: number;
  backupPollMs?: number;
};

type RealtimeSubscriber = {
  onChange: () => void;
  setMode: (mode: RealtimeMode) => void;
  fallbackPollMs: number;
  backupPollMs: number;
};

type SharedRealtimeChannel = {
  channelName: string;
  table: RealtimeTable;
  filter: string;
  channel: RealtimeChannel;
  supabase: SupabaseClient;
  subscribers: Set<RealtimeSubscriber>;
  pollId: ReturnType<typeof setInterval> | null;
  state: RealtimeMode;
  lastRealtimeEventAt: number;
};

const sharedChannels = new Map<string, SharedRealtimeChannel>();
let globalListenersInstalled = false;
let watchdogInstalled = false;

function assertLocationFilter(locationId: string, filter: string) {
  const required = `location_id=eq.${locationId}`;
  if (!filter.includes(required)) {
    const message = `Realtime filter must include ${required}`;
    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    }
  }
}

function notifySubscribers(entry: SharedRealtimeChannel) {
  for (const subscriber of entry.subscribers) {
    subscriber.onChange();
  }
}

function broadcastMode(entry: SharedRealtimeChannel, mode: RealtimeMode) {
  entry.state = mode;
  for (const subscriber of entry.subscribers) {
    subscriber.setMode(mode);
  }
}

function scheduleSharedPoll(entry: SharedRealtimeChannel) {
  if (entry.pollId) clearInterval(entry.pollId);
  if (entry.subscribers.size === 0) return;

  let fallbackPollMs = REALTIME_FALLBACK_POLL_MS;
  let backupPollMs = REALTIME_BACKUP_POLL_MS;

  for (const subscriber of entry.subscribers) {
    fallbackPollMs = Math.min(fallbackPollMs, subscriber.fallbackPollMs);
    backupPollMs = Math.min(backupPollMs, subscriber.backupPollMs);
  }

  const intervalMs = entry.state === "live" ? backupPollMs : fallbackPollMs;
  entry.pollId = setInterval(() => notifySubscribers(entry), intervalMs);
}

function attachChannelSubscription(entry: SharedRealtimeChannel) {
  entry.channel = entry.supabase
    .channel(entry.channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: entry.table,
        filter: entry.filter,
      },
      () => {
        entry.lastRealtimeEventAt = Date.now();
        notifySubscribers(entry);
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        entry.lastRealtimeEventAt = Date.now();
        broadcastMode(entry, "live");
        scheduleSharedPoll(entry);
        notifySubscribers(entry);
        return;
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        broadcastMode(entry, "polling");
        scheduleSharedPoll(entry);
      }
    });
}

function reconnectSharedChannel(entry: SharedRealtimeChannel) {
  broadcastMode(entry, "connecting");
  if (entry.pollId) {
    clearInterval(entry.pollId);
    entry.pollId = null;
  }

  void entry.supabase.removeChannel(entry.channel).finally(() => {
    if (entry.subscribers.size === 0) return;
    attachChannelSubscription(entry);
    scheduleSharedPoll(entry);
  });
}

/** Reconnect every open Realtime channel (e.g. after token refresh or tab focus). */
export function reconnectAllRealtimeChannels() {
  for (const entry of sharedChannels.values()) {
    notifySubscribers(entry);
    reconnectSharedChannel(entry);
  }
}

function installGlobalRealtimeRefresh() {
  if (globalListenersInstalled || typeof document === "undefined") return;
  globalListenersInstalled = true;

  const refresh = () => {
    for (const entry of sharedChannels.values()) {
      notifySubscribers(entry);
      reconnectSharedChannel(entry);
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refresh();
    }
  });
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
}

function installRealtimeWatchdog() {
  if (watchdogInstalled || typeof window === "undefined") return;
  watchdogInstalled = true;

  window.setInterval(() => {
    const now = Date.now();
    for (const entry of sharedChannels.values()) {
      if (entry.subscribers.size === 0) continue;

      const staleLive =
        entry.state === "live" && now - entry.lastRealtimeEventAt > 90_000;

      if (staleLive) {
        reconnectSharedChannel(entry);
      }
    }
  }, 30_000);
}

function acquireSharedChannel(
  channelName: string,
  table: RealtimeTable,
  filter: string,
  supabase: SupabaseClient
): SharedRealtimeChannel {
  const existing = sharedChannels.get(channelName);
  if (existing) {
    return existing;
  }

  installGlobalRealtimeRefresh();
  installRealtimeWatchdog();

  const entry: SharedRealtimeChannel = {
    channelName,
    table,
    filter,
    channel: null as unknown as RealtimeChannel,
    supabase,
    subscribers: new Set(),
    pollId: null,
    state: "connecting",
    lastRealtimeEventAt: Date.now(),
  };

  attachChannelSubscription(entry);
  sharedChannels.set(channelName, entry);
  return entry;
}

function releaseSharedChannel(channelName: string) {
  const entry = sharedChannels.get(channelName);
  if (!entry || entry.subscribers.size > 0) return;

  if (entry.pollId) clearInterval(entry.pollId);
  void entry.supabase.removeChannel(entry.channel);
  sharedChannels.delete(channelName);
}

export function usePostgresRealtime({
  channelName,
  table,
  locationId,
  filter,
  onChange,
  enabled = true,
  fallbackPollMs = REALTIME_FALLBACK_POLL_MS,
  backupPollMs = REALTIME_BACKUP_POLL_MS,
}: UsePostgresRealtimeOptions) {
  const [mode, setMode] = useState<RealtimeMode>("connecting");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !locationId) {
      setMode("polling");
      return;
    }

    assertLocationFilter(locationId, filter);

    const supabase = createClient();
    const subscriber: RealtimeSubscriber = {
      onChange: () => onChangeRef.current(),
      setMode,
      fallbackPollMs,
      backupPollMs,
    };

    const entry = acquireSharedChannel(channelName, table, filter, supabase);
    entry.subscribers.add(subscriber);
    setMode(entry.state);
    scheduleSharedPoll(entry);

    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        releaseSharedChannel(channelName);
      } else {
        scheduleSharedPoll(entry);
      }
    };
  }, [
    channelName,
    table,
    locationId,
    filter,
    enabled,
    fallbackPollMs,
    backupPollMs,
  ]);

  return mode;
}
