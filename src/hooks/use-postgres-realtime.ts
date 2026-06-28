"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
  REALTIME_STALE_LIVE_MS,
  REALTIME_WATCHDOG_MS,
} from "@/lib/constants";
import {
  assertLocationFilter,
  assertSessionFilter,
  broadcastMode,
  handlePostgresChange,
  handleSubscriptionStatus,
  notifySubscribers,
  resolveSharedPollIntervalMs,
  isStaleLiveConnection,
  type RealtimeMode,
  type RealtimeSubscriber,
  type RealtimeTable,
  type SharedRealtimeChannelState,
} from "@/lib/realtime/postgres-realtime-engine";

export type { RealtimeMode } from "@/lib/realtime/postgres-realtime-engine";

type UsePostgresRealtimeOptions = {
  channelName: string;
  table: RealtimeTable;
  locationId?: string;
  tableSessionId?: string;
  filter: string;
  onChange: () => void;
  enabled?: boolean;
  fallbackPollMs?: number;
  backupPollMs?: number;
};

type SharedRealtimeChannel = SharedRealtimeChannelState & {
  channel: RealtimeChannel | null;
  supabase: SupabaseClient;
};

const sharedChannels = new Map<string, SharedRealtimeChannel>();
let globalListenersInstalled = false;
let watchdogInstalled = false;

function scheduleSharedPoll(entry: SharedRealtimeChannel) {
  if (entry.pollId) clearInterval(entry.pollId);
  if (entry.subscribers.size === 0) return;

  const intervalMs = resolveSharedPollIntervalMs(entry);
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
        handlePostgresChange(entry);
      }
    )
    .subscribe((status) => {
      const mode = handleSubscriptionStatus(entry, status);
      if (mode === "live") {
        scheduleSharedPoll(entry);
        notifySubscribers(entry);
      } else if (mode === "polling") {
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

  if (entry.channel) {
    void entry.supabase.removeChannel(entry.channel).finally(() => {
      if (entry.subscribers.size === 0) return;
      attachChannelSubscription(entry);
      scheduleSharedPoll(entry);
    });
    return;
  }

  attachChannelSubscription(entry);
  scheduleSharedPoll(entry);
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

      if (isStaleLiveConnection(entry.state, entry.lastRealtimeEventAt, now)) {
        reconnectSharedChannel(entry);
      }
    }
  }, REALTIME_WATCHDOG_MS);
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
    channel: null,
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
  if (entry.channel) {
    void entry.supabase.removeChannel(entry.channel);
  }
  sharedChannels.delete(channelName);
}

export function usePostgresRealtime({
  channelName,
  table,
  locationId,
  tableSessionId,
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
    const locationScoped = table !== "denis_party_devices" && table !== "denis_timeline";
    const sessionScoped = table === "denis_party_devices";

    if (!enabled || (locationScoped && !locationId) || (sessionScoped && !tableSessionId)) {
      setMode("polling");
      return;
    }

    if (locationScoped && locationId) {
      assertLocationFilter(locationId, filter);
    }
    if (sessionScoped && tableSessionId) {
      assertSessionFilter(tableSessionId, filter);
    }

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
    tableSessionId,
    filter,
    enabled,
    fallbackPollMs,
    backupPollMs,
  ]);

  return mode;
}

/** @internal Test helpers */
export const __realtimeTestUtils = {
  sharedChannels,
  scheduleSharedPoll,
  attachChannelSubscription,
  reconnectSharedChannel,
  handlePostgresChange,
  handleSubscriptionStatus,
};
