import { describe, expect, it, vi } from "vitest";
import {
  broadcastMode,
  handlePostgresChange,
  handleSubscriptionStatus,
  isStaleLiveConnection,
  notifySubscribers,
  resolvePollIntervalMs,
  resolveSharedPollIntervalMs,
  subscriptionStatusToMode,
  type RealtimeSubscriber,
  type SharedRealtimeChannelState,
} from "@/lib/realtime/postgres-realtime-engine";
import {
  REALTIME_BACKUP_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
  REALTIME_STALE_LIVE_MS,
} from "@/lib/constants";

function createEntry(
  overrides: Partial<SharedRealtimeChannelState> = {}
): SharedRealtimeChannelState {
  return {
    channelName: "orders:test",
    table: "orders",
    filter: "location_id=eq.loc-1",
    subscribers: new Set(),
    pollId: null,
    state: "connecting",
    lastRealtimeEventAt: Date.now(),
    ...overrides,
  };
}

describe("postgres realtime engine", () => {
  it("maps subscription status to live or polling", () => {
    expect(subscriptionStatusToMode("SUBSCRIBED")).toBe("live");
    expect(subscriptionStatusToMode("CHANNEL_ERROR")).toBe("polling");
    expect(subscriptionStatusToMode("TIMED_OUT")).toBe("polling");
    expect(subscriptionStatusToMode("CLOSED")).toBe("polling");
    expect(subscriptionStatusToMode("JOINING")).toBe("ignore");
  });

  it("uses backup poll while live and fallback poll while polling", () => {
    expect(
      resolvePollIntervalMs("live", REALTIME_FALLBACK_POLL_MS, REALTIME_BACKUP_POLL_MS)
    ).toBe(REALTIME_BACKUP_POLL_MS);
    expect(
      resolvePollIntervalMs(
        "polling",
        REALTIME_FALLBACK_POLL_MS,
        REALTIME_BACKUP_POLL_MS
      )
    ).toBe(REALTIME_FALLBACK_POLL_MS);
  });

  it("picks the tightest subscriber poll interval", () => {
    const subscribers = new Set<RealtimeSubscriber>([
      {
        onChange: () => {},
        setMode: () => {},
        fallbackPollMs: 8_000,
        backupPollMs: 12_000,
      },
      {
        onChange: () => {},
        setMode: () => {},
        fallbackPollMs: 5_000,
        backupPollMs: 9_000,
      },
    ]);

    expect(
      resolveSharedPollIntervalMs({
        state: "polling",
        subscribers,
      })
    ).toBe(5_000);
  });

  it("notifies subscribers when postgres change arrives (insert order)", () => {
    const onChange = vi.fn();
    const entry = createEntry({
      subscribers: new Set([
        {
          onChange,
          setMode: () => {},
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
      ]),
    });

    handlePostgresChange(entry);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling when websocket channel closes", () => {
    const setMode = vi.fn();
    const entry = createEntry({
      subscribers: new Set([
        {
          onChange: () => {},
          setMode,
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
      ]),
    });

    const mode = handleSubscriptionStatus(entry, "CLOSED");
    expect(mode).toBe("polling");
    expect(setMode).toHaveBeenCalledWith("polling");
    expect(entry.state).toBe("polling");
  });

  it("marks stale live connections for reconnect", () => {
    const now = Date.now();
    expect(
      isStaleLiveConnection(
        "live",
        now - REALTIME_STALE_LIVE_MS - 1,
        now,
        REALTIME_STALE_LIVE_MS
      )
    ).toBe(true);
    expect(isStaleLiveConnection("polling", now - 999_999, now)).toBe(false);
  });

  it("broadcasts mode to all subscribers", () => {
    const setModeA = vi.fn();
    const setModeB = vi.fn();
    const entry = createEntry({
      subscribers: new Set([
        {
          onChange: () => {},
          setMode: setModeA,
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
        {
          onChange: () => {},
          setMode: setModeB,
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
      ]),
    });

    broadcastMode(entry, "live");
    expect(setModeA).toHaveBeenCalledWith("live");
    expect(setModeB).toHaveBeenCalledWith("live");
  });

  it("notifies every subscriber on shared poll tick", () => {
    const first = vi.fn();
    const second = vi.fn();
    const entry = createEntry({
      subscribers: new Set([
        {
          onChange: first,
          setMode: () => {},
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
        {
          onChange: second,
          setMode: () => {},
          fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
          backupPollMs: REALTIME_BACKUP_POLL_MS,
        },
      ]),
    });

    notifySubscribers(entry);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
