"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import type { MenuViewProps } from "@/components/guest/menu-view/props";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import {
  hydrateInitialMenuCategories,
  readMenuCacheForTable,
  writeMenuCache,
} from "@/lib/pwa/menu-cache";
import {
  AllergenFilter,
  useAllergenExclusions,
  allergenFilterStorageKey,
} from "@/components/guest/allergen-filter";
import { isProductHiddenByAllergenFilter } from "@/lib/allergens";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  personalizeMenu,
  personalizationBadgeByProductId,
  reorderCategoriesByPersonalization,
  type VkgPairingHint,
} from "@/lib/denis/intelligence/menu-personalization";
import { toMenuGuestMemoryProjection } from "@/lib/denis/learning/guest-memory/types";
import {
  formatScheduleGuestHint,
  isCategoryAvailable,
} from "@/lib/menu/schedule";
import { productMatchesSearch } from "@/lib/i18n/menu-locale";
import { getDemoGuestSession, isDemoGuestRoute } from "@/lib/demo-guest";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import {
  buildDrinkPairingPrompt,
  allergenIdsFromSheetSelections,
  apiPreferencesFromSheet,
} from "@/lib/ai/guest-sheet-preferences";
import { parseSceneChipSelections } from "@/lib/guest/denis-scene-turn";
import {
  legacyTokensForAiSession,
  readAiSessionIdForGuest,
  resetGuestStoresForTableSwitch,
  resolveGuestAiContextToken,
} from "@/lib/ai/guest-ai-token";
import { trackAiConversion } from "@/lib/ai/guest-session-storage";
import {
  ensureTableSession,
  syncTableSessionStores,
} from "@/lib/guest/ensure-table-session";
import type { AllergenId } from "@/lib/allergens";
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
import { useBrowseTelemetry } from "@/hooks/use-browse-telemetry";
import { useScrollIntelligence } from "@/hooks/use-scroll-intelligence";
import { useSmartNudges } from "@/hooks/use-smart-nudges";
import { useDenisSense } from "@/hooks/use-denis-sense";
import { proactiveDismissKeyFromBannerId } from "@/lib/denis/loop/build-proactive-banner-layers";
import type { GuestReorderCartItem } from "@/lib/guest/execute-guest-reorder";
import { useGuestMemory } from "@/hooks/use-guest-memory";
import { useTranslatedMenuCategories } from "@/hooks/use-translated-menu";
import { resolveAiPromptLanguage } from "@/lib/ai/config";
import {
  buildReturningGuestLoyaltyMessage,
  calculateLoyalty,
  DEFAULT_LOYALTY_CONFIG,
  shouldOfferLoyaltyToGuest,
} from "@/lib/denis/commerce/loyalty-program";
import type { ProductWithModifiers } from "@/types";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import { postDenisMessageTurn } from "@/lib/guest/denis-signal-client";
import { postDenisSense } from "@/lib/guest/denis-sense-client";
import { viewBannerLayers, viewCapacityAmbientLayer } from "@/lib/scene/layer-utils";
import { mergeOfflineBannerLayer } from "@/lib/scene/offline-banner-layer";
import { offlineGuestMessage, resolveOfflineMode } from "@/lib/offline/service-worker";
import { postBrowseTelemetry } from "@/lib/guest/post-browse-telemetry";
import { buildNudgeBrowseTelemetryEvent, type NudgeClickThroughEvent } from "@/lib/guest/scroll-intelligence";
import { useDenisView } from "@/hooks/use-denis-view";
import { usePartyCartSync } from "@/hooks/use-party-cart-sync";
import {
  registerMenuPeriodicSync,
  usePwaServiceWorkerMessages,
} from "@/lib/pwa/sw-messages";
import { getPendingOfflineOrderCount } from "@/lib/pwa/offline-order-queue";

export function useMenuView({
  slug,
  token,
  orgName,
  logoUrl,
  locationName,
  tableName,
  zoneName,
  categories: initialCategories,
  unavailableCategories = [],
  taxPercent,
  currency,
  locationId,
  tableId,
  timezone,
  orderingEnabled = true,
  acceptingOrders = true,
  aiConciergeEnabled = false,
  returnGuestEnabled = false,
  voiceEnabled = false,
  voiceTtsEnabled = true,
  googleReviewUrl = null,
  stripeOnboarded = false,
  paymentOnlineEnabled = false,
  paymentAtBarEnabled = false,
  paymentCardAtTableEnabled = false,
  inPersonPaymentLocation = "bar",
  trendingMenuProducts = null,
  menuVersion = "",
}: MenuViewProps) {
  const { tUI, tName, menuLocale, isEnglish } = useAppLocale();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { status: connectionStatus } = useConnectionStatus();
  usePwaServiceWorkerMessages();
  const scrollKey = `menu-scroll-${slug}-${token}`;
  const initialHydration = useMemo(
    () =>
      hydrateInitialMenuCategories({
        slug,
        token,
        fallback: initialCategories,
        menuVersion,
      }),
    [slug, token, initialCategories, menuVersion]
  );
  const [menuCategories, setMenuCategories] = useState(
    initialHydration.categories
  );
  const [showingCachedMenu, setShowingCachedMenu] = useState(
    initialHydration.showingCachedMenu
  );
  const [menuFreshLoaded, setMenuFreshLoaded] = useState(false);
  const canPlaceOrders = orderingEnabled && acceptingOrders;
  const guestOfflineMode = resolveOfflineMode({
    navigatorOnline: isOnline,
    hasMenuCache: Boolean(readMenuCacheForTable(slug, token)),
    pendingOrders: getPendingOfflineOrderCount(),
  });
  const isGuestConnectivityOffline =
    connectionStatus === "offline" || connectionStatus === "degraded";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    initialCategories[0]?.id ?? ""
  );
  const [now, setNow] = useState(() => new Date());
  const [detailProduct, setDetailProduct] = useState<ProductWithModifiers | null>(
    null
  );
  const [returnGlow, setReturnGlow] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [showRecommendedSection, setShowRecommendedSection] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<
    ProductRecommendation[]
  >([]);
  const [guestAllergies, setGuestAllergies] = useState<string[]>([]);
  const [guestMood, setGuestMood] = useState("");
  const [showPersonalizedHiddenAllergens, setShowPersonalizedHiddenAllergens] =
    useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const detectedLangStorageKey = `guest-detected-lang:${locationId}:${token}`;
  const [detectedGuestLanguage, setDetectedGuestLanguage] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(detectedLangStorageKey);
  });
  const [pairingRecommendation, setPairingRecommendation] =
    useState<ProductRecommendation | null>(null);
  const preAiExcludedRef = useRef<Set<AllergenId> | null>(null);
  const restoredScroll = useRef(false);
  const menuMainRef = useRef<HTMLElement>(null);

  const openProductDetail = useCallback((product: ProductWithModifiers) => {
    (document.activeElement as HTMLElement | null)?.blur();
    setDetailProduct(product);
  }, []);

  const addItem = useCart((s) => s.addItem);
  const cartItems = useCart((s) => s.items);
  const cartBump = useCart((s) => s.cartBump);
  const removedProductIds = useCart((s) => s.removedProductIds);
  const lastCartChangeAt = useCart((s) => s.lastCartChangeAt);
  const itemCount = useCart((s) => s.itemCount());
  const sessionToken = useGuestSession((s) => s.sessionToken);
  const guestTableId = useGuestSession((s) => s.tableId);
  const clearGuestSession = useGuestSession((s) => s.clearSession);

  useLayoutEffect(() => {
    const cart = useCart.getState();
    if (cart.restaurantSlug === slug && cart.tableToken === token) return;
    cart.setSession(
      slug,
      token,
      tableName,
      cart.sessionToken ?? sessionToken ?? ""
    );
  }, [slug, token, tableName, sessionToken]);

  const aiLegacyTokens = useMemo(
    () => legacyTokensForAiSession(tableId, sessionToken, guestTableId),
    [tableId, sessionToken, guestTableId]
  );

  const allergenStorageKey = allergenFilterStorageKey(slug, token);
  const { excluded, toggle, clear, replaceExcluded, count: allergenFilterCount } =
    useAllergenExclusions(allergenStorageKey);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setMenuCategories(initialCategories);
    setMenuFreshLoaded(true);
    writeMenuCache(slug, {
      slug,
      token,
      menuVersion,
      orgName,
      logoUrl: logoUrl ?? null,
      locationName,
      tableName,
      zoneName,
      categories: initialCategories,
      taxPercent,
      currency,
      locationId,
      tableId,
      timezone,
      orderingEnabled,
      acceptingOrders,
      aiConciergeEnabled,
    });
    if (isOnline) {
      setShowingCachedMenu(false);
    }
    void registerMenuPeriodicSync();
  }, [
    slug,
    token,
    orgName,
    logoUrl,
    locationName,
    tableName,
    zoneName,
    initialCategories,
    taxPercent,
    currency,
    locationId,
    tableId,
    timezone,
    orderingEnabled,
    acceptingOrders,
    aiConciergeEnabled,
    menuVersion,
    isOnline,
  ]);

  useEffect(() => {
    if (menuFreshLoaded || isOnline) return;
    const cached = readMenuCacheForTable(slug, token);
    if (cached) {
      setMenuCategories(cached.categories);
      setShowingCachedMenu(true);
    }
  }, [isOnline, slug, token, menuFreshLoaded]);

  const { scheduledCategories, scheduledUnavailable } = useMemo(() => {
    const available: MenuCategory[] = [];
    const unavailable: MenuCategory[] = [];

    for (const category of menuCategories) {
      const scheduleRow = {
        schedule_enabled: category.schedule_enabled ?? false,
        schedule_start: category.schedule_start ?? null,
        schedule_end: category.schedule_end ?? null,
        schedule_days: category.schedule_days ?? null,
      };

      if (isCategoryAvailable(scheduleRow, now, timezone)) {
        available.push(category);
      } else if (scheduleRow.schedule_enabled) {
        unavailable.push({
          ...category,
          scheduleHint:
            category.scheduleHint ??
            formatScheduleGuestHint(tName(category), scheduleRow) ??
            tUI("menu.scheduleUnavailable"),
        });
      }
    }

    return {
      scheduledCategories: available,
      scheduledUnavailable: unavailable,
    };
  }, [menuCategories, now, timezone, tName, tUI]);

  const language = isEnglish ? "en" : menuLocale;
  const deviceFingerprint = useMemo(() => getOrCreateDeviceFingerprint(), []);

  const {
    profile,
    memoryProjection,
    isReturning,
    lastVisitItems,
    knownAllergies,
    saveAllergies: saveGuestAllergies,
    showMemoryConsent,
    acceptMemoryConsent,
    declineMemoryConsent,
  } = useGuestMemory(locationId, {
    enabled: returnGuestEnabled && aiConciergeEnabled,
    tableId,
    sessionToken,
    deviceFingerprint,
    language,
  });

  const englishSplashTarget =
    isEnglish && menuLocale.toLowerCase().slice(0, 2) !== "en" ? "en" : null;

  const translationTarget =
    detectedGuestLanguage &&
    detectedGuestLanguage !== menuLocale.toLowerCase().slice(0, 2)
      ? detectedGuestLanguage
      : memoryProjection?.preferredLanguage &&
          memoryProjection.preferredLanguage.toLowerCase().slice(0, 2) !==
            menuLocale.toLowerCase().slice(0, 2)
        ? memoryProjection.preferredLanguage
        : englishSplashTarget;

  const { categories: translatedScheduledCategories } = useTranslatedMenuCategories({
    categories: scheduledCategories,
    targetLanguage: translationTarget,
    sourceLanguage: menuLocale,
    locationId,
    tableId,
    sessionToken,
    enabled: aiConciergeEnabled && Boolean(translationTarget),
  });

  const displayCategories = translationTarget
    ? translatedScheduledCategories
    : scheduledCategories;

  const menuPersonalizationEnabled = useMemo(
    () =>
      aiConciergeEnabled &&
      isCommerceCapabilityActive({
        capabilityId: "menu.personalization",
        cohortKey: sessionToken ?? token,
      }),
    [aiConciergeEnabled, sessionToken, token]
  );

  const menuPersonalization = useMemo(() => {
    if (!menuPersonalizationEnabled) {
      return {
        categories: displayCategories,
        meta: null,
        badges: new Map<
          string,
          {
            boost: "favorite" | "trending" | "recommended" | "new" | null;
            allergenWarning: string | null;
            recommendedLabel: string | null;
          }
        >(),
      };
    }

    const guestAllergens = [
      ...guestAllergies,
      ...knownAllergies,
      ...(memoryProjection?.allergyLabels ?? []),
    ];
    const priceAffinity =
      memoryProjection?.avgSpendCents != null &&
      memoryProjection.avgSpendCents >= 3500
        ? "premium"
        : memoryProjection?.avgSpendCents != null &&
            memoryProjection.avgSpendCents <= 1500
          ? "budget"
          : "mid";

    const vkgPairings: VkgPairingHint[] = [];
    if (pairingRecommendation) {
      const anchorName =
        cartItems[cartItems.length - 1]?.productName ??
        memoryProjection?.lastVisitItemNames[0] ??
        "jelo";
      vkgPairings.push({
        productId: pairingRecommendation.productId,
        productName: pairingRecommendation.name,
        anchorProductName: anchorName,
      });
    }

    const { sections, meta } = personalizeMenu({
      fullMenu: displayCategories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          allergens: product.allergens,
          created_at: product.created_at,
          sort_order: product.sort_order,
        })),
      })),
      guestMemory: toMenuGuestMemoryProjection(memoryProjection),
      guestAllergens,
      browseProfile: emptyBrowseProfile(),
      priceAffinity,
      trendingProductIds: trendingMenuProducts?.productIds ?? [],
      trendingOrderCountsToday: trendingMenuProducts?.orderCountsToday ?? {},
      vkgPairings,
      language,
    });

    return {
      categories: reorderCategoriesByPersonalization(
        displayCategories,
        sections,
        { showHiddenAllergens: showPersonalizedHiddenAllergens }
      ),
      meta,
      badges: personalizationBadgeByProductId(sections),
    };
  }, [
    guestAllergies,
    knownAllergies,
    language,
    memoryProjection,
    menuPersonalizationEnabled,
    displayCategories,
    showPersonalizedHiddenAllergens,
    trendingMenuProducts,
    cartItems,
    pairingRecommendation,
  ]);

  const personalizedCategories = menuPersonalization.categories;

  const allUnavailableCategories = useMemo(
    () => [...scheduledUnavailable, ...unavailableCategories],
    [scheduledUnavailable, unavailableCategories]
  );

  const subtitle = zoneName
    ? `${zoneName} · ${locationName}`
    : locationName;

  useEffect(() => {
    if (guestTableId && guestTableId !== tableId) {
      resetGuestStoresForTableSwitch(
        locationId,
        token,
        tableId,
        legacyTokensForAiSession(guestTableId, sessionToken, guestTableId)
      );
      clearGuestSession();
    }
    void ensureTableSession(slug, token, tableId);
  }, [token, slug, tableId, locationId, guestTableId, sessionToken, clearGuestSession]);

  useEffect(() => {
    if (!aiConciergeEnabled || !isDemoGuestRoute(slug, token)) return;
    const demo = getDemoGuestSession();
    syncTableSessionStores(slug, token, demo, demo.tableId);
  }, [aiConciergeEnabled, slug, token]);

  useEffect(() => {
    if (restoredScroll.current) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved, 10));
        restoredScroll.current = true;
        if (itemCount > 0) setReturnGlow(true);
        setTimeout(() => setReturnGlow(false), 2000);
      });
    }
  }, [scrollKey, itemCount]);

  useEffect(() => {
    const save = () => sessionStorage.setItem(scrollKey, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [scrollKey]);

  const filteredCategories = useMemo(() => {
    if (allergenFilterCount === 0) return personalizedCategories;
    return personalizedCategories
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (product) =>
            !isProductHiddenByAllergenFilter(product.allergens, excluded)
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [personalizedCategories, excluded, allergenFilterCount]);

  useEffect(() => {
    if (search.trim() || !filteredCategories.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveCategory(visible[0].target.id.replace("cat-", ""));
        }
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: 0 }
    );

    filteredCategories.forEach((cat) => {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredCategories, search]);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`cat-${catId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = readMenuCacheForTable(slug, token);
      if (cached) {
        setMenuCategories(cached.categories);
        setShowingCachedMenu(true);
      }
      return;
    }
    router.refresh();
  }, [router, slug, token]);

  const hiddenByAllergenCount = useMemo(() => {
    if (allergenFilterCount === 0) return 0;
    const total = personalizedCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    const visible = filteredCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    return total - visible;
  }, [personalizedCategories, filteredCategories, allergenFilterCount]);

  useEffect(() => {
    if (!filteredCategories.length) return;
    if (!filteredCategories.some((cat) => cat.id === activeCategory)) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategory]);

  const allProducts = filteredCategories.flatMap((c) => c.products);
  const menuSectionByProductId = useMemo(() => {
    const map = new Map<string, MenuSection>();
    for (const category of filteredCategories) {
      const section = inferMenuSection(category);
      for (const product of category.products) {
        map.set(product.id, section);
      }
    }
    return map;
  }, [filteredCategories]);
  const searchQuery = search.trim();
  const filtered = searchQuery
    ? allProducts.filter((p) => productMatchesSearch(p, searchQuery))
    : null;

  const welcomeBackMessage = useMemo(() => {
    if (!isReturning || !lastVisitItems.length) return null;
    const base = tUI("ai.memory.welcomeBack", {
      items: lastVisitItems.slice(0, 4).join(", "),
    });
    if (
      !memoryProjection ||
      !shouldOfferLoyaltyToGuest(memoryProjection) ||
      !memoryProjection.engagementConsentAt
    ) {
      return base;
    }
    const loyalty = calculateLoyalty({
      guestMemory: memoryProjection,
      orders: [],
      config: DEFAULT_LOYALTY_CONFIG,
      optedIn: true,
    });
    const loyaltyLine = buildReturningGuestLoyaltyMessage({
      loyalty,
      language,
    });
    return loyaltyLine ? `${base} ${loyaltyLine}` : base;
  }, [isReturning, lastVisitItems, tUI, memoryProjection, language]);

  const {
    scene,
    view: denisView,
    loading: sceneLoading,
    refresh: refreshGuestSceneView,
    sseConnected,
  } = useDenisView({
    tableToken: token,
    sessionToken,
    enabled: aiConciergeEnabled && !!sessionToken,
  });

  usePartyCartSync({
    enabled: aiConciergeEnabled && !!sessionToken,
    partyMode: "shared_cart",
    tableToken: token,
    sessionToken,
    tableSessionId: denisView?.sessionId ?? null,
    deviceFingerprint,
    viewRevision: denisView?.cart.revision ?? null,
    sseConnected,
  });

  const viewOrders = denisView?.orders ?? [];

  const sceneBanners = useMemo(
    () =>
      mergeOfflineBannerLayer(viewBannerLayers(denisView), {
        offline: isGuestConnectivityOffline,
        message: offlineGuestMessage(guestOfflineMode, language),
      }),
    [denisView, guestOfflineMode, isGuestConnectivityOffline, language]
  );
  const capacityAmbient = useMemo(
    () => viewCapacityAmbientLayer(denisView),
    [denisView]
  );
  const useSceneBannerUi = sceneBanners.length > 0;

  const hasSessionOrders = viewOrders.length > 0;

  useEffect(() => {
    if (!aiConciergeEnabled || !sessionToken) return;
    const stored = readAiSessionIdForGuest(locationId, token, aiLegacyTokens);
    if (stored) setAiSessionId(stored);
  }, [aiConciergeEnabled, sessionToken, locationId, token]);

  const aiContextToken = resolveGuestAiContextToken(token, sessionToken);

  const categoryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of menuCategories) {
      map[category.id] = tName(category);
    }
    return map;
  }, [menuCategories, tName]);

  const postScrollBrowseEvent = useCallback(
    (event: import("@/lib/denis/cognition/browse/browse-types").BrowseEvent) => {
      if (!aiConciergeEnabled || !aiContextToken || isDemoGuestRoute(slug, token)) {
        return;
      }
      void postBrowseTelemetry({
        tableToken: token,
        tableSessionToken: sessionToken ?? undefined,
        locationId,
        tableId,
        aiSessionId,
        deviceFingerprint,
        event,
      }).catch(() => {
        // non-blocking scroll telemetry
      });
    },
    [
      aiConciergeEnabled,
      aiContextToken,
      slug,
      token,
      sessionToken,
      locationId,
      tableId,
      aiSessionId,
      deviceFingerprint,
    ]
  );

  const postNudgeTelemetry = useCallback(
    (event: NudgeClickThroughEvent) => {
      if (!aiContextToken || isDemoGuestRoute(slug, token)) return;
      void postBrowseTelemetry({
        tableToken: token,
        tableSessionToken: sessionToken ?? undefined,
        locationId,
        tableId,
        aiSessionId,
        deviceFingerprint,
        event: buildNudgeBrowseTelemetryEvent(event),
      }).catch(() => {
        // non-blocking nudge A/B telemetry
      });
    },
    [
      aiContextToken,
      slug,
      token,
      sessionToken,
      locationId,
      tableId,
      aiSessionId,
      deviceFingerprint,
    ]
  );

  const scrollIntelEnabled =
    (aiConciergeEnabled || (canPlaceOrders && !isGuestConnectivityOffline)) &&
    !isDemoGuestRoute(slug, token);

  const { getAiContext, browseMinutes, latestScrollIntent, categoryViewCounts } =
    useScrollIntelligence(menuCategories, {
      enabled: scrollIntelEnabled,
      containerRef: menuMainRef,
      activeCategoryId: activeCategory,
      hasOrdered: itemCount > 0 || hasSessionOrders,
      tName,
      onScrollBrowseEvent: postScrollBrowseEvent,
      formatContext: ({ minutes, topSummary, hasOrdered, scrollIntent }) =>
        tUI("ai.scroll.context", {
          minutes,
          items: topSummary,
          orderNote: tUI(
            hasOrdered ? "ai.scroll.ordered" : "ai.scroll.notOrdered"
          ),
          scrollIntent: scrollIntent ?? "",
        }),
    });

  const feedbackOrder = useMemo(
    () => viewOrders.find((order) => order.status === "delivered") ?? null,
    [viewOrders]
  );

  const showFeedback = !!feedbackOrder && !!sessionToken;

  const productById = useMemo(() => {
    const map = new Map<string, ProductWithModifiers>();
    for (const category of menuCategories) {
      for (const product of category.products) {
        map.set(product.id, product);
      }
    }
    return map;
  }, [menuCategories]);

  const menuSectionByProductIdAll = useMemo(() => {
    const map = new Map<string, MenuSection>();
    for (const category of menuCategories) {
      const section = inferMenuSection(category);
      for (const product of category.products) {
        map.set(product.id, section);
      }
    }
    return map;
  }, [menuCategories]);

  const customizableProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const product of productById.values()) {
      if (
        (product.modifier_groups?.length ?? 0) > 0 ||
        product.requires_serve_size
      ) {
        ids.add(product.id);
      }
    }
    return ids;
  }, [productById]);

  const aiReasonByProductId = useMemo(() => {
    if (!aiActive) return undefined;
    const map = new Map<string, string>();
    for (const rec of aiRecommendations) {
      if (rec.reason) map.set(rec.productId, rec.reason);
    }
    return map;
  }, [aiActive, aiRecommendations]);

  const hasDrinkInCart = useMemo(
    () => cartItems.some((item) => item.menuSection === "drinks"),
    [cartItems]
  );

  const fetchPairingForNudge = useCallback(
    async (prompt: string) => {
      if (aiConciergeEnabled) return null;
      const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
      if (!aiContextToken || hasDrinkInCart || isDemoGuestRoute(slug, token)) {
        return null;
      }

      const sessionId =
        aiSessionId ??
        readAiSessionIdForGuest(locationId, token, aiLegacyTokens) ??
        undefined;

      try {
        const res = await postDenisMessageTurn({
          tableToken: token,
          tableSessionToken: sessionToken ?? undefined,
          locationId,
          tableId,
          message: prompt,
          language,
          aiSessionId: sessionId,
          preferences: { allergies: guestAllergies, mood: guestMood },
          includeOrderContext: false,
          browsingContext: getAiContext(),
        });
        const json = await res.json();
        if (!res.ok) return null;
        return (json.data as { recommendations?: ProductRecommendation[] })
          .recommendations?.[0] ?? null;
      } catch {
        return null;
      }
    },
    [
      aiConciergeEnabled,
      token,
      sessionToken,
      hasDrinkInCart,
      slug,
      aiSessionId,
      locationId,
      tableId,
      language,
      guestAllergies,
      guestMood,
      getAiContext,
    ]
  );

  const smartNudgeMessages = useMemo(
    () => ({
      browse: tUI("ai.nudge.browse"),
      dessert: tUI("ai.nudge.dessert"),
      slowKitchen: tUI("ai.nudge.slowKitchen"),
    }),
    [tUI]
  );

  const formatPairingMessage = useCallback(
    (rec: ProductRecommendation) =>
      tUI("ai.proactive.pairing", {
        name: rec.name,
        price: formatPrice(rec.price, currency),
      }),
    [tUI, currency]
  );

  useDenisSense({
    enabled:
      aiConciergeEnabled &&
      canPlaceOrders &&
      !!aiContextToken &&
      !isGuestConnectivityOffline,
    locationId,
    tableId,
    sessionToken: aiContextToken,
    aiSessionId,
    deviceFingerprint,
    cartItems,
    cartBump,
    removedProductIds,
    lastCartChangeAt,
    language,
  });

  useBrowseTelemetry({
    enabled:
      aiConciergeEnabled &&
      !!aiContextToken &&
      !isDemoGuestRoute(slug, token),
    tableToken: token,
    tableSessionToken: sessionToken ?? undefined,
    locationId,
    tableId,
    aiSessionId,
    deviceFingerprint,
    categories: menuCategories,
    containerRef: menuMainRef,
    activeCategoryId: activeCategory,
    detailProduct,
    cartItems,
    cartBump,
  });

  const { activeNudge, dismiss: dismissNudge, accept: acceptNudge } = useSmartNudges({
    enabled: !aiConciergeEnabled && canPlaceOrders && !isGuestConnectivityOffline,
    sessionKey: sessionToken ?? token,
    browseMinutes,
    cartItemCount: itemCount,
    hasSessionOrders,
    hasDrinkInCart,
    aiChatOpen,
    orders: [],
    latestScrollIntent,
    categoryViewCounts,
    categoryLabels,
    messages: smartNudgeMessages,
    formatPairingMessage,
    fetchPairingRecommendation: fetchPairingForNudge,
    onNudgeTelemetry: postNudgeTelemetry,
  });

  const resetAiRecommendations = useCallback(() => {
    setAiRecommendations([]);
    setAiActive(false);
    setShowRecommendedSection(true);
    setGuestAllergies([]);
    setGuestMood("");
    setPairingRecommendation(null);
    if (preAiExcludedRef.current) {
      replaceExcluded([...preAiExcludedRef.current]);
      preAiExcludedRef.current = null;
    }
  }, [replaceExcluded]);

  useEffect(() => {
    return () => {
      if (preAiExcludedRef.current) {
        replaceExcluded([...preAiExcludedRef.current]);
      }
    };
  }, [replaceExcluded]);

  useEffect(() => {
    if (hasDrinkInCart) setPairingRecommendation(null);
  }, [hasDrinkInCart]);

  const fetchDrinkPairing = useCallback(
    async (dishName: string) => {
      const aiContextToken = resolveGuestAiContextToken(token, sessionToken);
      if (!aiContextToken || hasDrinkInCart) return;

      const sessionId =
        aiSessionId ??
        readAiSessionIdForGuest(locationId, token, aiLegacyTokens) ??
        undefined;

      try {
        const res = await postDenisMessageTurn({
          tableToken: token,
          tableSessionToken: sessionToken ?? undefined,
          locationId,
          tableId,
          message: buildDrinkPairingPrompt(dishName),
          language,
          aiSessionId: sessionId,
          preferences: { allergies: guestAllergies, mood: guestMood },
          includeOrderContext: false,
        });

        const json = await res.json();
        if (!res.ok) return;

        const rec = (json.data as { recommendations?: ProductRecommendation[] })
          .recommendations?.[0];
        if (rec) setPairingRecommendation(rec);
      } catch {
        // non-blocking pairing
      }
    },
    [
      sessionToken,
      hasDrinkInCart,
      aiSessionId,
      locationId,
      tableId,
      language,
      guestAllergies,
      guestMood,
    ]
  );

  const handleAddAiRecommendation = useCallback(
    (rec: ProductRecommendation) => {
      const product = productById.get(rec.productId);
      const section = menuSectionByProductIdAll.get(rec.productId) ?? "food";

      hapticClick();
      addItem({
        productId: rec.productId,
        productName: rec.name,
        unitPrice: rec.price,
        quantity: 1,
        notes: "",
        menuSection: section,
        productTaxRate: product?.tax_rate ?? null,
        modifiers: [],
      });
      toastAddedToCart(rec.name, rec.price, currency);

      const sid =
        aiSessionId ??
        readAiSessionIdForGuest(locationId, token, aiLegacyTokens);
      if (sid) {
        void trackAiConversion({
          sessionId: sid,
          productId: rec.productId,
          locationId,
          tableId,
          sessionToken: resolveGuestAiContextToken(token, sessionToken),
        });
      }

      if (section !== "drinks" && !hasDrinkInCart) {
        void fetchDrinkPairing(rec.name);
      }
    },
    [
      productById,
      menuSectionByProductIdAll,
      addItem,
      aiSessionId,
      sessionToken,
      locationId,
      tableId,
      hasDrinkInCart,
      fetchDrinkPairing,
      currency,
    ]
  );

  const handleAddPairing = useCallback(() => {
    if (!pairingRecommendation) return;

    const rec = pairingRecommendation;
    const product = productById.get(rec.productId);
    const section = menuSectionByProductIdAll.get(rec.productId) ?? "drinks";

    hapticClick();
    addItem({
      productId: rec.productId,
      productName: rec.name,
      unitPrice: rec.price,
      quantity: 1,
      notes: "",
      menuSection: section,
      productTaxRate: product?.tax_rate ?? null,
      modifiers: [],
    });
    toastAddedToCart(rec.name, rec.price, currency);
    setPairingRecommendation(null);

    const sid =
      aiSessionId ??
      readAiSessionIdForGuest(locationId, token, aiLegacyTokens);
    if (sid) {
      void trackAiConversion({
        sessionId: sid,
        productId: rec.productId,
        locationId,
        tableId,
        sessionToken: resolveGuestAiContextToken(token, sessionToken),
      });
    }
  }, [
    pairingRecommendation,
    productById,
    menuSectionByProductIdAll,
    addItem,
    currency,
    aiSessionId,
    sessionToken,
    locationId,
    tableId,
  ]);

  const applySceneChipSelections = useCallback(
    (selections: ReturnType<typeof parseSceneChipSelections>) => {
      if (!selections) return;

      const prefs = apiPreferencesFromSheet(selections);
      setGuestAllergies(prefs.allergies);
      if (selections.mood) {
        setGuestMood(prefs.mood);
      }

      const allergenIds = allergenIdsFromSheetSelections(selections.allergies);
      if (allergenIds.length > 0) {
        if (!preAiExcludedRef.current) {
          preAiExcludedRef.current = new Set(excluded);
        }
        replaceExcluded(allergenIds);
      }

      void saveGuestAllergies(prefs.allergies, selections.allergies);
    },
    [excluded, replaceExcluded, saveGuestAllergies]
  );

  const handleSceneTurnResult = useCallback(
    (result: {
      sessionId: string | null;
      recommendations: ProductRecommendation[];
    }) => {
      if (result.sessionId) {
        setAiSessionId(result.sessionId);
      }
      if (result.recommendations.length) {
        setAiRecommendations(result.recommendations);
        setAiActive(true);
        setShowRecommendedSection(true);
      }
    },
    []
  );

  const handleSceneInlineAdd = useCallback(
    (productId: string) => {
      const product = productById.get(productId);
      if (!product) return;
      handleAddAiRecommendation({
        productId,
        name: product.name,
        price: Number(product.price),
        reason: "",
        imageUrl: product.image_url ?? null,
      });
    },
    [productById, handleAddAiRecommendation]
  );

  const handleApplyReorderItems = useCallback(
    (items: GuestReorderCartItem[]) => {
      for (const item of items) {
        addItem({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          notes: item.notes,
          menuSection: item.menuSection,
          productTaxRate: item.productTaxRate,
          modifiers: item.modifiers,
        });
      }
    },
    [addItem]
  );

  const handleNudgeAction = useCallback(() => {
    hapticClick();
    acceptNudge();
    setAiChatOpen(true);
    dismissNudge();
  }, [acceptNudge, dismissNudge]);

  const handleSceneBannerAction = useCallback(
    (banner: (typeof sceneBanners)[number]) => {
      hapticClick();
      if (banner.action === "add_product" && banner.productId) {
        const product = productById.get(banner.productId);
        if (product) {
          openProductDetail(product);
          return;
        }
      }
      setAiChatOpen(true);
    },
    [productById, openProductDetail]
  );

  const handleSceneBannerDismiss = useCallback(
    (bannerId: string) => {
      const dismissKey = proactiveDismissKeyFromBannerId(bannerId);
      if (!dismissKey || !aiContextToken) return;

      void postDenisSense({
        locationId,
        tableId,
        sessionToken: aiContextToken,
        aiSessionId: aiSessionId ?? undefined,
        deviceFingerprint: deviceFingerprint ?? undefined,
        channel: "telemetry.scroll",
        payload: { dismissedNudgeKeys: [dismissKey] },
      }).then(() => refreshGuestSceneView());
    },
    [
      aiContextToken,
      aiSessionId,
      deviceFingerprint,
      locationId,
      refreshGuestSceneView,
      tableId,
    ]
  );

  const handleNudgeAdd = useCallback(() => {
    if (!activeNudge?.recommendation) return;
    handleAddAiRecommendation(activeNudge.recommendation);
    dismissNudge();
  }, [activeNudge, dismissNudge, handleAddAiRecommendation]);

  const handleAiChatSetupComplete = useCallback(
    async ({
      recommendations,
      sessionId,
      preferences,
      allergenIds,
    }: {
      recommendations: ProductRecommendation[];
      sessionId: string | null;
      preferences: { allergies: string[]; mood: string };
      allergenIds: AllergenId[];
    }) => {
      setGuestAllergies(preferences.allergies);
      setGuestMood(preferences.mood);

      if (allergenIds.length > 0) {
        if (!preAiExcludedRef.current) {
          preAiExcludedRef.current = new Set(excluded);
        }
        replaceExcluded(allergenIds);
      }

      if (sessionId) {
        setAiSessionId(sessionId);
      }

      setAiRecommendations(recommendations);
      setAiActive(true);
      setShowRecommendedSection(true);
    },
    [excluded, replaceExcluded]
  );

  const handleGuestLanguageDetected = useCallback(
    (language: string) => {
      const normalized = resolveAiPromptLanguage(language);
      if (normalized === menuLocale.toLowerCase().slice(0, 2)) return;
      setDetectedGuestLanguage(normalized);
      sessionStorage.setItem(detectedLangStorageKey, normalized);
    },
    [detectedLangStorageKey, menuLocale]
  );

  return {
    tUI,
    router,
    isOnline,
    menuCategories,
    showingCachedMenu,
    canPlaceOrders,
    search,
    setSearch,
    activeCategory,
    detailProduct,
    setDetailProduct,
    returnGlow,
    aiChatOpen,
    setAiChatOpen,
    aiActive,
    showRecommendedSection,
    setShowRecommendedSection,
    aiRecommendations,
    pairingRecommendation,
    setPairingRecommendation,
    menuMainRef,
    openProductDetail,
    itemCount,
    sessionToken,
    filteredCategories,
    scrollToCategory,
    excluded,
    toggle,
    clear,
    handleRefresh,
    hiddenByAllergenCount,
    menuPersonalization,
    showPersonalizedHiddenAllergens,
    setShowPersonalizedHiddenAllergens,
    allUnavailableCategories,
    subtitle,
    welcomeBackMessage,
    scene,
    denisView,
    sceneLoading,
    refreshGuestSceneView,
    viewOrders,
    sceneBanners,
    capacityAmbient,
    useSceneBannerUi,
    hasSessionOrders,
    aiSessionId,
    aiContextToken,
    getAiContext,
    feedbackOrder,
    showFeedback,
    productById,
    menuSectionByProductId,
    menuSectionByProductIdAll,
    customizableProductIds,
    aiReasonByProductId,
    hasDrinkInCart,
    activeNudge,
    dismissNudge,
    resetAiRecommendations,
    handleAddAiRecommendation,
    handleAddPairing,
    applySceneChipSelections,
    handleSceneTurnResult,
    handleSceneInlineAdd,
    handleApplyReorderItems,
    handleNudgeAction,
    handleSceneBannerAction,
    handleSceneBannerDismiss,
    handleNudgeAdd,
    handleAiChatSetupComplete,
    handleGuestLanguageDetected,
    profile,
    isReturning,
    saveGuestAllergies,
    showMemoryConsent,
    acceptMemoryConsent,
    declineMemoryConsent,
    filtered,
    searchQuery,
    deviceFingerprint,
    aiLegacyTokens,
  };
}

export type MenuViewState = ReturnType<typeof useMenuView>;
