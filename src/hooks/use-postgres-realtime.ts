"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
} from "@/lib/constants";

export type RealtimeMode = "connecting" | "live" | "polling";

type UsePostgresRealtimeOptions = {
  channelName: string;
  table: "orders" | "waiter_calls";
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
  channel: RealtimeChannel;
  supabase: SupabaseClient;
  subscribers: Set<RealtimeSubscriber>;
  pollId: ReturnType<typeof setInterval> | null;
  state: RealtimeMode;
};

const sharedChannels = new Map<string, SharedRealtimeChannel>();

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

function acquireSharedChannel(
  channelName: string,
  table: "orders" | "waiter_calls",
  filter: string,
  supabase: SupabaseClient
): SharedRealtimeChannel {
  const existing = sharedChannels.get(channelName);
  if (existing) {
    return existing;
  }

  const entry: SharedRealtimeChannel = {
    channel: null as unknown as RealtimeChannel,
    supabase,
    subscribers: new Set(),
    pollId: null,
    state: "connecting",
  };

  entry.channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter,
      },
      () => notifySubscribers(entry)
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        entry.state = "live";
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
        entry.state = "polling";
        broadcastMode(entry, "polling");
        scheduleSharedPoll(entry);
      }
    });

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
