import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
  REALTIME_STALE_LIVE_MS,
} from "@/lib/constants";

export type RealtimeMode = "connecting" | "live" | "polling";

export type RealtimeTable =
  | "orders"
  | "table_sessions"
  | "waiter_calls"
  | "denis_staff_notifications"
  | "denis_party_devices"
  | "denis_timeline";

export type RealtimeSubscriber = {
  onChange: () => void;
  setMode: (mode: RealtimeMode) => void;
  fallbackPollMs: number;
  backupPollMs: number;
};

export type SharedRealtimeChannelState = {
  channelName: string;
  table: RealtimeTable;
  filter: string;
  subscribers: Set<RealtimeSubscriber>;
  pollId: ReturnType<typeof setInterval> | null;
  state: RealtimeMode;
  lastRealtimeEventAt: number;
};

export function subscriptionStatusToMode(
  status: string
): RealtimeMode | "ignore" {
  if (status === "SUBSCRIBED") return "live";
  if (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  ) {
    return "polling";
  }
  return "ignore";
}

export function resolvePollIntervalMs(
  mode: RealtimeMode,
  fallbackPollMs = REALTIME_FALLBACK_POLL_MS,
  backupPollMs = REALTIME_BACKUP_POLL_MS
): number {
  return mode === "live" ? backupPollMs : fallbackPollMs;
}

export function resolveSharedPollIntervalMs(
  entry: Pick<SharedRealtimeChannelState, "state" | "subscribers">,
  defaults: {
    fallbackPollMs?: number;
    backupPollMs?: number;
  } = {}
): number {
  let fallbackPollMs = defaults.fallbackPollMs ?? REALTIME_FALLBACK_POLL_MS;
  let backupPollMs = defaults.backupPollMs ?? REALTIME_BACKUP_POLL_MS;

  for (const subscriber of entry.subscribers) {
    fallbackPollMs = Math.min(fallbackPollMs, subscriber.fallbackPollMs);
    backupPollMs = Math.min(backupPollMs, subscriber.backupPollMs);
  }

  return resolvePollIntervalMs(entry.state, fallbackPollMs, backupPollMs);
}

export function isStaleLiveConnection(
  state: RealtimeMode,
  lastRealtimeEventAt: number,
  now: number,
  staleMs = REALTIME_STALE_LIVE_MS
): boolean {
  return state === "live" && now - lastRealtimeEventAt > staleMs;
}

export function assertLocationFilter(locationId: string, filter: string) {
  const required = `location_id=eq.${locationId}`;
  if (!filter.includes(required)) {
    const message = `Realtime filter must include ${required}`;
    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    }
  }
}

export function assertSessionFilter(tableSessionId: string, filter: string) {
  const required = `table_session_id=eq.${tableSessionId}`;
  if (!filter.includes(required)) {
    const message = `Realtime filter must include ${required}`;
    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    }
  }
}

export function notifySubscribers(entry: SharedRealtimeChannelState) {
  for (const subscriber of entry.subscribers) {
    subscriber.onChange();
  }
}

export function broadcastMode(
  entry: SharedRealtimeChannelState,
  mode: RealtimeMode
) {
  entry.state = mode;
  for (const subscriber of entry.subscribers) {
    subscriber.setMode(mode);
  }
}

export function handlePostgresChange(entry: SharedRealtimeChannelState) {
  entry.lastRealtimeEventAt = Date.now();
  notifySubscribers(entry);
}

export function handleSubscriptionStatus(
  entry: SharedRealtimeChannelState,
  status: string
): RealtimeMode | null {
  const nextMode = subscriptionStatusToMode(status);
  if (nextMode === "ignore") return null;

  if (nextMode === "live") {
    entry.lastRealtimeEventAt = Date.now();
  }

  broadcastMode(entry, nextMode);
  return nextMode;
}
