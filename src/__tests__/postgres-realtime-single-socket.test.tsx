import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon-key" },
}));

function makeFakeChannel() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      cb?.("SUBSCRIBED");
      return channel;
    }),
  };
  return channel;
}

describe("usePostgresRealtime — end-to-end single-socket proof", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("mounting 3 hook instances (like waiter-table-detail.tsx) opens exactly ONE physical client/socket, with 3 logical channels multiplexed over it", async () => {
    const channelMock = vi.fn((_name: string) => makeFakeChannel());
    const removeChannelMock = vi.fn().mockResolvedValue({ status: "ok" });
    const fakeClient = { channel: channelMock, removeChannel: removeChannelMock };
    const createBrowserClientMock = vi.fn(() => fakeClient);

    vi.doMock("@supabase/ssr", () => ({
      createBrowserClient: createBrowserClientMock,
    }));

    const { usePostgresRealtime } = await import("@/hooks/use-postgres-realtime");

    // Mirrors waiter-table-detail.tsx: 3 distinct realtime feeds for one table.
    const tableId = "table-42";
    renderHook(() =>
      usePostgresRealtime({
        channelName: `waiter-table-detail-orders:${tableId}`,
        table: "orders",
        locationId: "loc-1",
        filter: `location_id=eq.loc-1,table_id=eq.${tableId}`,
        onChange: () => {},
      })
    );
    renderHook(() =>
      usePostgresRealtime({
        channelName: `waiter-table-detail-stations:${tableId}`,
        table: "order_station_states",
        locationId: "loc-1",
        filter: `location_id=eq.loc-1,table_id=eq.${tableId}`,
        onChange: () => {},
      })
    );
    renderHook(() =>
      usePostgresRealtime({
        channelName: `waiter-table-detail-calls:${tableId}`,
        table: "waiter_calls",
        locationId: "loc-1",
        filter: `location_id=eq.loc-1,table_id=eq.${tableId}`,
        onChange: () => {},
      })
    );

    // The regression this guards against: createClient() used to build a
    // fresh SupabaseClient (and thus a fresh physical Realtime WebSocket)
    // on every call. Proof of the fix: exactly one underlying client got
    // constructed no matter how many usePostgresRealtime() calls mounted...
    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
    // ...while all 3 logical channels were still opened, just multiplexed
    // over that one client's one Realtime socket.
    expect(channelMock).toHaveBeenCalledTimes(3);
    expect(channelMock.mock.calls.map((call) => call[0])).toEqual([
      `waiter-table-detail-orders:${tableId}`,
      `waiter-table-detail-stations:${tableId}`,
      `waiter-table-detail-calls:${tableId}`,
    ]);
  });
});
