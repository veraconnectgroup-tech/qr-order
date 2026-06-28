import { describe, expect, it } from "vitest";
import {
  buildOfflineCapability,
  isDenisChatAllowedOffline,
  mergeQueuedOrder,
  offlineGuestMessage,
  pruneExpiredQueuedOrders,
  resolveMenuCacheStrategy,
  resolveOfflineMode,
  summarizeOfflineSync,
  type QueuedOrder,
} from "@/lib/offline/service-worker";

describe("offline service-worker orchestration", () => {
  it("resolves offline mode from connectivity", () => {
    expect(
      resolveOfflineMode({
        navigatorOnline: true,
        hasMenuCache: true,
        pendingOrders: 0,
      })
    ).toBe("online");

    expect(
      resolveOfflineMode({
        navigatorOnline: true,
        hasMenuCache: true,
        pendingOrders: 2,
      })
    ).toBe("intermittent");

    expect(
      resolveOfflineMode({
        navigatorOnline: false,
        hasMenuCache: true,
        pendingOrders: 0,
      })
    ).toBe("offline");
  });

  it("disables Denis chat when offline", () => {
    expect(isDenisChatAllowedOffline("offline")).toBe(false);
    expect(isDenisChatAllowedOffline("online")).toBe(true);
  });

  it("shows offline guest messaging", () => {
    expect(offlineGuestMessage("offline")).toMatch(/Offline mod/i);
    expect(offlineGuestMessage("intermittent")).toMatch(/spremljena/i);
  });

  it("expires queued orders after 2 hours", () => {
    const old: QueuedOrder = {
      id: "1",
      items: [],
      tableId: "t1",
      tableToken: "tok",
      sessionToken: "sess",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      syncStatus: "pending",
    };
    const fresh: QueuedOrder = {
      ...old,
      id: "2",
      createdAt: new Date().toISOString(),
    };
    const pruned = pruneExpiredQueuedOrders([old, fresh]);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.id).toBe("2");
  });

  it("uses stale-while-revalidate for menu when online", () => {
    const strategy = resolveMenuCacheStrategy({
      cached: {
        slug: "cafe",
        token: "tok",
        categories: [],
        cachedAt: new Date().toISOString(),
        locationId: "loc",
        tableId: "tbl",
      },
      freshFetched: false,
      online: true,
    });
    expect(strategy.useCache).toBe(true);
    expect(strategy.shouldRefresh).toBe(true);
  });

  it("queues orders locally in offline capability", () => {
    const capability = buildOfflineCapability({
      menuCached: true,
      queuedOrders: [],
      lastSyncAt: null,
      offlineSince: new Date().toISOString(),
    });
    const queued = mergeQueuedOrder(capability.queuedOrders, {
      items: [
        {
          productId: "p1",
          productName: "Ćevapi",
          quantity: 1,
          unitPrice: 850,
        },
      ],
      tableId: "t1",
      tableToken: "tok",
      sessionToken: "sess",
    });
    expect(queued).toHaveLength(1);
    expect(queued[0]?.syncStatus).toBe("pending");
  });

  it("summarizes staff sync alert", () => {
    const alert = summarizeOfflineSync({
      synced: [{ id: "1" } as QueuedOrder, { id: "2" } as QueuedOrder, { id: "3" } as QueuedOrder],
      failed: [],
      expired: 0,
      staffAlert: null,
    });
    expect(alert).toMatch(/3 offline narudžbe/);
  });
});
