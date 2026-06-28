import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  enqueueOfflineOrder,
  flushOfflineOrderQueue,
  getPendingOfflineOrderCount,
  pruneExpiredQueuedOrders,
  type QueuedOrder,
} from "@/lib/pwa/offline-order-queue";
import {
  hydrateInitialMenuCategories,
  readMenuCacheForTable,
  resolveGuestMenuHydration,
  writeMenuCache,
} from "@/lib/pwa/menu-cache";
import { runDenisOfflineTurn } from "@/lib/guest/denis-offline-turn";
import { mergeOfflineBannerLayer } from "@/lib/scene/offline-banner-layer";
import type { ProductWithModifiers } from "@/types";

const storage = new Map<string, string>();

describe("guest offline mode", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queues offline orders and flushes them when back online", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    enqueueOfflineOrder({
      sessionToken: "sess-1",
      tableToken: "table-1",
      payload: { items: [{ productId: "p1", quantity: 1 }] },
    });
    enqueueOfflineOrder({
      sessionToken: "sess-1",
      tableToken: "table-1",
      payload: { items: [{ productId: "p2", quantity: 2 }] },
    });

    expect(getPendingOfflineOrderCount()).toBe(2);

    const firstFlush = await flushOfflineOrderQueue();
    expect(firstFlush.sent).toBe(1);
    expect(firstFlush.failed).toBe(1);
    expect(getPendingOfflineOrderCount()).toBe(1);

    fetchMock.mockResolvedValueOnce({ ok: true });
    const secondFlush = await flushOfflineOrderQueue();
    expect(secondFlush.sent).toBe(1);
    expect(getPendingOfflineOrderCount()).toBe(0);
  });

  it("serves cached menu instantly while fresh menu revalidates", () => {
    const cachedProduct = {
      id: "p1",
      name: "Cevapi",
      price: 850,
      allergens: [],
      modifier_groups: [],
    } as unknown as ProductWithModifiers;

    writeMenuCache("cafe", {
      slug: "cafe",
      token: "tok-a",
      menuVersion: "test-version",
      orgName: "Cafe",
      logoUrl: null,
      locationName: "Main",
      tableName: "T1",
      zoneName: null,
      categories: [
        {
          id: "cat-1",
          name: "Grill",
          products: [cachedProduct],
        },
      ],
      taxPercent: 19,
      currency: "EUR",
      locationId: "loc-1",
      tableId: "tbl-1",
      timezone: "Europe/Berlin",
      orderingEnabled: true,
      acceptingOrders: true,
      aiConciergeEnabled: false,
    });

    const hydration = resolveGuestMenuHydration({
      slug: "cafe",
      token: "tok-a",
      freshFetched: false,
      online: true,
    });

    expect(hydration.useCache).toBe(true);
    expect(hydration.shouldRefresh).toBe(true);
    expect(hydration.showingCachedMenu).toBe(true);
    expect(readMenuCacheForTable("cafe", "tok-a")?.categories[0]?.products[0]?.name).toBe(
      "Cevapi"
    );

    const initial = hydrateInitialMenuCategories({
      slug: "cafe",
      token: "tok-a",
      fallback: [],
    });
    expect(initial.showingCachedMenu).toBe(true);
    expect(initial.categories[0]?.products[0]?.name).toBe("Cevapi");
  });

  it("extracts ordering slots locally for Denis offline turns", () => {
    const offlineProduct = {
      id: "p1",
      name: "Cevapi",
      price: 850,
      allergens: [],
      modifier_groups: [],
    } as unknown as ProductWithModifiers;

    const result = runDenisOfflineTurn({
      guestMessage: "2 cevapi",
      language: "sr",
      categories: [
        {
          id: "cat-1",
          name: "Grill",
          products: [offlineProduct],
        },
      ],
      cartItemCount: 0,
    });

    expect(result.cartActions).toHaveLength(1);
    expect(result.cartActions?.[0]?.productId).toBe("p1");
    expect(result.cartActions?.[0]?.quantity).toBe(2);
  });

  it("prepends offline banner layer in scene projection", () => {
    const merged = mergeOfflineBannerLayer([], {
      offline: true,
      message: "Offline mod — meni iz keša",
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("guest-offline-mode");
  });

  it("drops expired queued orders", () => {
    const expired: QueuedOrder = {
      id: "old",
      sessionToken: "sess",
      tableToken: "tok",
      payload: {},
      createdAt: Date.now() - 3 * 60 * 60 * 1000,
    };
    expect(pruneExpiredQueuedOrders([expired])).toHaveLength(0);
  });
});
