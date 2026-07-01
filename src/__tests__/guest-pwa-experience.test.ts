import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildReturnGuestWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-welcome-message";
import {
  isDenisReturningGuest,
  readDenisGuestMemoryLocal,
  recordDenisGuestVisit,
  saveDenisGuestLanguage,
} from "@/lib/guest/denis-guest-memory-local";
import {
  getGuestPageViewCount,
  hasGuestPlacedOrder,
  recordGuestOrderPlaced,
  recordGuestPageView,
  resetGuestInstallPromptState,
  shouldShowGuestInstallPrompt,
} from "@/lib/pwa/install-timing";
import {
  hydrateInitialMenuCategories,
  invalidateGuestMenuCache,
  isGuestMenuCacheStale,
  readMenuCacheForTable,
  resolveGuestMenuHydration,
  writeMenuCache,
} from "@/lib/pwa/menu-cache";
import type { ProductWithModifiers } from "@/types";

const storage = new Map<string, string>();

describe("guest PWA install timing M17", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows install prompt after 3 page views", () => {
    resetGuestInstallPromptState();
    expect(shouldShowGuestInstallPrompt()).toBe(false);
    recordGuestPageView();
    recordGuestPageView();
    expect(shouldShowGuestInstallPrompt()).toBe(false);
    recordGuestPageView();
    expect(shouldShowGuestInstallPrompt()).toBe(true);
    expect(getGuestPageViewCount()).toBe(3);
  });

  it("shows install prompt after 1 order placed", () => {
    resetGuestInstallPromptState();
    recordGuestOrderPlaced();
    expect(hasGuestPlacedOrder()).toBe(true);
    expect(shouldShowGuestInstallPrompt()).toBe(true);
  });
});

describe("guest memory local M17", () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads returning guest memory from localStorage", () => {
    recordDenisGuestVisit("loc-1", ["Schnitzel", "Pilsner"]);
    saveDenisGuestLanguage("loc-1", "sr");

    const memory = readDenisGuestMemoryLocal("loc-1");
    expect(memory.lastVisitItems).toEqual(["Schnitzel", "Pilsner"]);
    expect(memory.preferredLanguage).toBe("sr");
    expect(isDenisReturningGuest("loc-1")).toBe(true);

    const welcome = buildReturnGuestWelcomeMessage({
      language: "sr",
      lastVisitItems: memory.lastVisitItems,
      visitCount: 2,
    });
    expect(welcome).toContain("Schnitzel");
  });
});

describe("guest offline menu cache M17", () => {
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
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves cached menu offline with stale-while-revalidate", () => {
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
      menuVersion: "2026-06-28T10:00:00.000Z",
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
      online: false,
      freshMenuVersion: "2026-06-28T10:00:00.000Z",
    });

    expect(hydration.useCache).toBe(true);
    expect(hydration.showingCachedMenu).toBe(true);
    expect(readMenuCacheForTable("cafe", "tok-a")?.categories[0]?.products[0]?.name).toBe(
      "Cevapi"
    );

    const initial = hydrateInitialMenuCategories({
      slug: "cafe",
      token: "tok-a",
      fallback: [],
      menuVersion: "2026-06-28T10:00:00.000Z",
    });
    expect(initial.showingCachedMenu).toBe(true);
    expect(initial.categories[0]?.products[0]?.name).toBe("Cevapi");
  });

  it("invalidates cache when menu version changes", () => {
    writeMenuCache("cafe", {
      slug: "cafe",
      token: "tok-a",
      menuVersion: "v1",
      orgName: "Cafe",
      logoUrl: null,
      locationName: "Main",
      tableName: "T1",
      zoneName: null,
      categories: [],
      taxPercent: 19,
      currency: "EUR",
      locationId: "loc-1",
      tableId: "tbl-1",
      timezone: "Europe/Berlin",
      orderingEnabled: true,
      acceptingOrders: true,
      aiConciergeEnabled: false,
    });

    const cached = readMenuCacheForTable("cafe", "tok-a");
    expect(cached).not.toBeNull();
    expect(isGuestMenuCacheStale(cached!, "v2")).toBe(true);

    const hydration = resolveGuestMenuHydration({
      slug: "cafe",
      token: "tok-a",
      freshFetched: false,
      online: true,
      freshMenuVersion: "v2",
    });
    expect(hydration.useCache).toBe(false);
    expect(readMenuCacheForTable("cafe", "tok-a")).toBeNull();

    invalidateGuestMenuCache("cafe");
    expect(readMenuCacheForTable("cafe", "tok-a")).toBeNull();
  });
});
