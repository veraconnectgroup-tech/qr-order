"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { CartSummaryBar } from "@/components/guest/cart-summary-bar";
import { CategoryPills } from "@/components/guest/category-pills";
import { GuestHeader } from "@/components/guest/guest-header";
import { LanguageSelector } from "@/components/guest/language-selector";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { OfflineIndicator } from "@/components/guest/offline-indicator";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { readMenuCache, writeMenuCache } from "@/lib/pwa/menu-cache";
import { cn } from "@/lib/utils";
import {
  registerMenuPeriodicSync,
  usePwaServiceWorkerMessages,
} from "@/lib/pwa/sw-messages";
import { MenuListItem } from "@/components/guest/menu-list-item";
import { ProductDetailSheet } from "@/components/guest/product-detail-sheet";
import { PullToRefresh } from "@/components/guest/pull-to-refresh";
import {
  AllergenFilter,
  useAllergenExclusions,
  allergenFilterStorageKey,
} from "@/components/guest/allergen-filter";
import { MenuGrid, type MenuCategory } from "@/components/guest/menu-grid";
import { isProductHiddenByAllergenFilter } from "@/lib/allergens";
import {
  formatScheduleGuestHint,
  isCategoryAvailable,
} from "@/lib/menu/schedule";
import { productMatchesSearch } from "@/lib/i18n/menu-locale";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import {
  buildDrinkPairingPrompt,
  allergenIdsFromSheetSelections,
  apiPreferencesFromSheet,
} from "@/lib/ai/guest-sheet-preferences";
import {
  parseSceneChipSelections,
  parseSceneHandoffChip,
  runGuestDenisSceneTurn,
} from "@/lib/guest/denis-scene-turn";
import {
  legacyTokensForAiSession,
  readAiSessionIdForGuest,
  resetGuestStoresForTableSwitch,
  resolveGuestAiContextToken,
} from "@/lib/ai/guest-ai-token";
import { trackAiConversion } from "@/lib/ai/guest-session-storage";
import { ensureTableSession } from "@/lib/guest/ensure-table-session";
import { requestGuestWaiterCall } from "@/lib/guest/request-waiter-call";
import type { AllergenId } from "@/lib/allergens";
import { toastAddedToCart } from "@/lib/cart-toast";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
import { useScrollIntelligence } from "@/hooks/use-scroll-intelligence";
import { useSmartNudges } from "@/hooks/use-smart-nudges";
import { useDenisSense } from "@/hooks/use-denis-sense";
import { shouldCommitProactiveToDock } from "@/lib/denis/loop/proactive-dock-tell";
import { useGuestTableOrders } from "@/hooks/use-guest-table-orders";
import { useGuestMemory } from "@/hooks/use-guest-memory";
import { DenisMemoryConsentBanner } from "@/components/guest/denis-memory-consent-banner";
import { AiSmartNudgeBanner } from "@/components/guest/ai-smart-nudge-banner";
import type { ProductWithModifiers } from "@/types";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import {
  buildManualCartSnapshot,
  manualCartRevision,
} from "@/lib/guest/manual-cart-snapshot";
import { postDenisMessageTurn } from "@/lib/guest/denis-signal-client";
import { postDenisSense } from "@/lib/guest/denis-sense-client";
import { sceneBannerLayers } from "@/lib/scene/layer-utils";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";
import { useDenisView } from "@/hooks/use-denis-view";
import type { InPersonPaymentLocation } from "@/lib/constants";

const AiCartPairingBanner = dynamic(
  () =>
    import("@/components/guest/ai-cart-pairing-banner").then((m) => ({
      default: m.AiCartPairingBanner,
    })),
  { ssr: false }
);
const DenisGuestDock = dynamic(
  () =>
    import("@/components/guest/denis-guest-dock").then((m) => ({
      default: m.DenisGuestDock,
    })),
  { ssr: false }
);
const DenisSceneBanners = dynamic(
  () =>
    import("@/components/guest/denis-scene-banners").then((m) => ({
      default: m.DenisSceneBanners,
    })),
  { ssr: false }
);
const AiConciergeChat = dynamic(
  () =>
    import("@/components/guest/ai-concierge-chat").then((m) => ({
      default: m.AiConciergeChat,
    })),
  { ssr: false }
);
const GuestOrderFocusSheet = dynamic(
  () =>
    import("@/components/guest/guest-order-focus-sheet").then((m) => ({
      default: m.GuestOrderFocusSheet,
    })),
  { ssr: false }
);
const GuestSessionBillSheet = dynamic(
  () =>
    import("@/components/guest/guest-session-bill-sheet").then((m) => ({
      default: m.GuestSessionBillSheet,
    })),
  { ssr: false }
);
const AiRecommendedSection = dynamic(
  () =>
    import("@/components/guest/ai-recommended-section").then((m) => ({
      default: m.AiRecommendedSection,
    })),
  { ssr: false }
);
const AiFeedbackPrompt = dynamic(
  () =>
    import("@/components/guest/ai-feedback-prompt").then((m) => ({
      default: m.AiFeedbackPrompt,
    })),
  { ssr: false }
);

export function MenuView({
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
  memoryConsentPrompt = null,
  voiceEnabled = false,
  voiceTtsEnabled = true,
  googleReviewUrl = null,
  stripeOnboarded = false,
  paymentOnlineEnabled = false,
  paymentAtBarEnabled = false,
  paymentCardAtTableEnabled = false,
  inPersonPaymentLocation = "bar" as InPersonPaymentLocation,
}: {
  slug: string;
  token: string;
  orgName: string;
  logoUrl?: string | null;
  locationName: string;
  tableName: string;
  zoneName: string | null;
  categories: MenuCategory[];
  unavailableCategories?: MenuCategory[];
  taxPercent: number;
  currency: string;
  locationId: string;
  tableId: string;
  timezone: string;
  orderingEnabled?: boolean;
  acceptingOrders?: boolean;
  aiConciergeEnabled?: boolean;
  returnGuestEnabled?: boolean;
  memoryConsentPrompt?: string | null;
  voiceEnabled?: boolean;
  voiceTtsEnabled?: boolean;
  googleReviewUrl?: string | null;
  stripeOnboarded?: boolean;
  paymentOnlineEnabled?: boolean;
  paymentAtBarEnabled?: boolean;
  paymentCardAtTableEnabled?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
}) {
  const { tUI, tName, menuLocale, isEnglish } = useAppLocale();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  usePwaServiceWorkerMessages();
  const scrollKey = `menu-scroll-${slug}-${token}`;
  const [menuCategories, setMenuCategories] = useState(initialCategories);
  const [showingCachedMenu, setShowingCachedMenu] = useState(false);
  const canPlaceOrders = orderingEnabled && acceptingOrders && isOnline;
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
  const [sceneRefreshKey, setSceneRefreshKey] = useState(0);
  const [sceneTurnBusy, setSceneTurnBusy] = useState(false);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [billSheetOpen, setBillSheetOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [showRecommendedSection, setShowRecommendedSection] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState<
    ProductRecommendation[]
  >([]);
  const [guestAllergies, setGuestAllergies] = useState<string[]>([]);
  const [guestMood, setGuestMood] = useState("");
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
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
    writeMenuCache(slug, {
      slug,
      token,
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
  ]);

  useEffect(() => {
    if (isOnline) {
      setShowingCachedMenu(false);
      return;
    }
    const cached = readMenuCache(slug);
    if (cached?.token === token) {
      setMenuCategories(cached.categories);
      setShowingCachedMenu(true);
    }
  }, [isOnline, slug, token]);

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
    if (allergenFilterCount === 0) return scheduledCategories;
    return scheduledCategories
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (product) =>
            !isProductHiddenByAllergenFilter(product.allergens, excluded)
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [scheduledCategories, excluded, allergenFilterCount]);

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
      const cached = readMenuCache(slug);
      if (cached?.token === token) {
        setMenuCategories(cached.categories);
        setShowingCachedMenu(true);
      }
      return;
    }
    router.refresh();
  }, [router, slug, token]);

  const hiddenByAllergenCount = useMemo(() => {
    if (allergenFilterCount === 0) return 0;
    const total = scheduledCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    const visible = filteredCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    return total - visible;
  }, [scheduledCategories, filteredCategories, allergenFilterCount]);

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

  const language = isEnglish ? "en" : menuLocale;

  const deviceFingerprint = useMemo(() => getOrCreateDeviceFingerprint(), []);

  const {
    profile,
    isReturning,
    lastVisitItems,
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

  const welcomeBackMessage = useMemo(() => {
    if (!isReturning || !lastVisitItems.length) return null;
    return tUI("ai.memory.welcomeBack", {
      items: lastVisitItems.slice(0, 4).join(", "),
    });
  }, [isReturning, lastVisitItems, tUI]);

  const { orders: sessionOrders } = useGuestTableOrders(
    token,
    sessionToken,
    aiConciergeEnabled && !!sessionToken
  );

  const hasLiveKitchenOrders = useMemo(
    () =>
      sessionOrders.some(
        (order) =>
          order.status === "pending" ||
          order.status === "confirmed" ||
          order.status === "preparing" ||
          order.status === "ready"
      ),
    [sessionOrders]
  );

  const {
    scene,
    view: denisView,
    loading: sceneLoading,
    refresh: refreshGuestSceneView,
  } = useDenisView({
    tableToken: token,
    sessionToken,
    enabled: aiConciergeEnabled && !!sessionToken,
    refreshKey: sceneRefreshKey,
    fastPoll: hasLiveKitchenOrders || itemCount > 0 || sessionOrders.length > 0,
  });

  const sceneBanners = useMemo(
    () => (scene ? sceneBannerLayers(scene) : []),
    [scene]
  );
  const useSceneBannerUi = sceneBanners.length > 0;

  const hasSessionOrders = sessionOrders.length > 0;

  useEffect(() => {
    if (!aiConciergeEnabled || !sessionToken) return;
    const stored = readAiSessionIdForGuest(locationId, token, aiLegacyTokens);
    if (stored) setAiSessionId(stored);
  }, [aiConciergeEnabled, sessionToken, locationId, token]);

  const aiContextToken = resolveGuestAiContextToken(token, sessionToken);

  const { getAiContext, browseMinutes } = useScrollIntelligence(menuCategories, {
    enabled: aiConciergeEnabled,
    containerRef: menuMainRef,
    hasOrdered: itemCount > 0 || hasSessionOrders,
    tName,
    formatContext: ({ minutes, topSummary, hasOrdered }) =>
      tUI("ai.scroll.context", {
        minutes,
        items: topSummary,
        orderNote: tUI(
          hasOrdered ? "ai.scroll.ordered" : "ai.scroll.notOrdered"
        ),
      }),
  });

  const feedbackOrder = useMemo(() => {
    return sessionOrders
      .filter((order) => order.status === "delivered")
      .sort(
        (a, b) =>
          new Date(b.delivered_at ?? b.created_at).getTime() -
          new Date(a.delivered_at ?? a.created_at).getTime()
      )[0];
  }, [sessionOrders]);

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
      token,
      sessionToken,
      hasDrinkInCart,
      slug,
      token,
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

  const getManualCartSnapshot = useCallback(() => {
    if (cartItems.length === 0) return undefined;
    return buildManualCartSnapshot(
      cartItems,
      manualCartRevision(cartItems, cartBump)
    );
  }, [cartItems, cartBump]);

  useDenisSense({
    enabled: aiConciergeEnabled && canPlaceOrders && !!aiContextToken,
    locationId,
    tableId,
    sessionToken: aiContextToken,
    aiSessionId,
    deviceFingerprint,
    cartItems,
    cartBump,
  });

  const fetchServerProactive = useCallback(
    async ({ dismissedKeys }: { dismissedKeys: string[] }) => {
      if (!aiContextToken || isDemoGuestRoute(slug, token)) return null;

      const sessionId =
        aiSessionId ??
        readAiSessionIdForGuest(locationId, token, aiLegacyTokens) ??
        undefined;

      const result = await postDenisSense({
        locationId,
        tableId,
        sessionToken: aiContextToken,
        aiSessionId: sessionId,
        deviceFingerprint,
        channel: "system.proactive_tick",
        payload: {
          browseMinutes,
          cartItemCount: itemCount,
          hasSessionOrders,
          hasDrinkInCart,
          dismissedNudgeKeys: dismissedKeys,
          browseMessage: smartNudgeMessages.browse,
          dessertMessage: smartNudgeMessages.dessert,
          slowKitchenMessage: smartNudgeMessages.slowKitchen,
        },
      });

      const nudge = result?.proactiveNudge ?? null;
      if (!nudge) return null;

      if (shouldCommitProactiveToDock(nudge.kind)) {
        return null;
      }

      const transcriptTexts = new Set(
        (denisView?.transcript ?? [])
          .filter((entry) => entry.role === "denis")
          .map((entry) => entry.text.trim())
      );
      if (transcriptTexts.has(nudge.message.trim())) {
        return null;
      }

      return nudge;
    },
    [
      aiContextToken,
      slug,
      token,
      aiSessionId,
      locationId,
      tableId,
      sessionToken,
      browseMinutes,
      itemCount,
      hasSessionOrders,
      hasDrinkInCart,
      smartNudgeMessages,
      deviceFingerprint,
      denisView?.transcript,
    ]
  );

  const { activeNudge, dismiss: dismissNudge } = useSmartNudges({
    enabled: aiConciergeEnabled && canPlaceOrders,
    browseMinutes,
    cartItemCount: itemCount,
    hasSessionOrders,
    hasDrinkInCart,
    aiChatOpen,
    orders: sessionOrders,
    messages: smartNudgeMessages,
    formatPairingMessage,
    fetchPairingRecommendation: fetchPairingForNudge,
    fetchServerProactive,
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

  const handleOpenDenisDesk = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
  }, []);

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

  const runSceneChipTurn = useCallback(
    async (input: {
      chipId: string;
      label: string;
      message?: string;
      selections?: ReturnType<typeof parseSceneChipSelections>;
    }) => {
      if (!sessionToken || sceneTurnBusy) return;

      setSceneTurnBusy(true);
      try {
        const result = await runGuestDenisSceneTurn({
          locationId,
          tableId,
          tableToken: token,
          sessionToken,
          message: input.message ?? input.label,
          language,
          browsingContext: getAiContext(),
          selections: input.selections ?? undefined,
          allowOrdering: canPlaceOrders,
          preferences:
            input.selections != null
              ? apiPreferencesFromSheet(input.selections)
              : {
                  allergies: guestAllergies,
                  mood: guestMood,
                },
        });

        if (result.sessionId) {
          setAiSessionId(result.sessionId);
        }

        if (result.recommendations.length) {
          setAiRecommendations(result.recommendations);
          setAiActive(true);
          setShowRecommendedSection(true);
        }

        setSceneRefreshKey((key) => key + 1);
        await refreshGuestSceneView();
      } catch {
        toast.error(tUI("ai.overlay.error"));
      } finally {
        setSceneTurnBusy(false);
      }
    },
    [
      sessionToken,
      sceneTurnBusy,
      locationId,
      tableId,
      token,
      language,
      getAiContext,
      guestAllergies,
      guestMood,
      refreshGuestSceneView,
      tUI,
      canPlaceOrders,
    ]
  );

  useEffect(() => {
    if (!sessionOrders.length) return;
    void refreshGuestSceneView();
  }, [sessionOrders, refreshGuestSceneView]);

  const handleSceneChipPress = useCallback(
    (chipId: string, label: string) => {
      hapticClick();

      if (chipId === TABLE_ACTION_CHIP_IDS.orderMore) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (chipId === TABLE_ACTION_CHIP_IDS.viewBill) {
        setBillSheetOpen(true);
        return;
      }

      if (chipId === "situation-waiter") {
        void (async () => {
          try {
            await requestGuestWaiterCall({
              tableToken: token,
              sessionToken,
            });
            toast.success(tUI("waiter.notified"), {
              description: tUI("waiter.notifiedBody"),
            });
            setSceneRefreshKey((key) => key + 1);
            await refreshGuestSceneView();
          } catch {
            toast.error(tUI("waiter.error"), {
              description: tUI("waiter.errorHint"),
            });
          }
        })();
        return;
      }

      const handoffChip = parseSceneHandoffChip(chipId, label);
      if (handoffChip?.structuredIntent) {
        if (!sessionToken) {
          toast.error(tUI("waiter.sessionError"), {
            description: tUI("waiter.sessionErrorHint"),
          });
          return;
        }
        void (async () => {
          try {
            const result = await runGuestDenisSceneTurn({
              locationId,
              tableId,
              tableToken: token,
              sessionToken,
              message: label,
              language,
              structuredIntent: handoffChip.structuredIntent,
              handoffPaymentMethod: handoffChip.handoffPaymentMethod,
              allowOrdering: canPlaceOrders,
            });
            if (result.openPaymentSheet) {
              setBillSheetOpen(true);
            }
            setSceneRefreshKey((key) => key + 1);
            await refreshGuestSceneView();
          } catch {
            toast.error(tUI("ai.overlay.error"));
          }
        })();
        return;
      }

      if (chipId === "situation-wrong") {
        void runSceneChipTurn({
          chipId,
          label,
          message: tUI("scene.situation.chipWrong"),
        });
        return;
      }

      const selections = parseSceneChipSelections(chipId);
      if (selections) {
        applySceneChipSelections(selections);
        void runSceneChipTurn({ chipId, label, selections });
        return;
      }

      void runSceneChipTurn({ chipId, label });
    },
    [
      sessionToken,
      token,
      tUI,
      refreshGuestSceneView,
      runSceneChipTurn,
      applySceneChipSelections,
    ]
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

  const handleNudgeAction = useCallback(() => {
    hapticClick();
    setAiChatOpen(true);
    dismissNudge();
  }, [dismissNudge]);

  const handleAiChatOpenChange = useCallback((open: boolean) => {
    setAiChatOpen(open);
    if (!open) {
      setSceneRefreshKey((key) => key + 1);
    }
  }, []);

  const handleGuestSceneRefresh = useCallback(() => {
    void refreshGuestSceneView();
  }, [refreshGuestSceneView]);

  const handleOrderPress = useCallback(
    (orderId: string) => {
      hapticClick();
      const order = scene?.chrome.situation?.orders.find(
        (row) => row.orderId === orderId
      );
      if (order?.primaryAction.kind === "open_bill") {
        setBillSheetOpen(true);
        return;
      }
      setFocusOrderId(orderId);
    },
    [scene]
  );

  const handleSceneBannerAction = useCallback(
    (banner: (typeof sceneBanners)[number]) => {
      hapticClick();
      if (banner.action === "view_order" && banner.orderId) {
        setFocusOrderId(banner.orderId);
        return;
      }
      if (banner.action === "view_bill") {
        setBillSheetOpen(true);
        return;
      }
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
      setSceneRefreshKey((key) => key + 1);
    },
    [excluded, replaceExcluded]
  );

  return (
    <>
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh} orgInitial={orgName.charAt(0)}>
        <div
          className={cn(
            aiConciergeEnabled && !aiChatOpen
              ? orderingEnabled &&
                !detailProduct &&
                !aiChatOpen &&
                itemCount > 0
                ? "min-h-dvh pb-[calc(11rem+env(safe-area-inset-bottom,0px))]"
                : "min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
              : "min-h-dvh pb-cart-offset",
            aiChatOpen && "pointer-events-none select-none"
          )}
        >
          <GuestHeader
            orgName={orgName}
            logoUrl={logoUrl}
            subtitle={subtitle}
            tableName={tableName}
            trailing={<LanguageSelector compact />}
          />

          {!orderingEnabled && (
            <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              Browse our menu. To order, ask your server.
            </div>
          )}

          {orderingEnabled && !acceptingOrders && (
            <div className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {tUI("menu.orderingPaused")}
            </div>
          )}

          {showMemoryConsent && (
            <DenisMemoryConsentBanner
              onAccept={() => void acceptMemoryConsent()}
              onDecline={declineMemoryConsent}
              promptTemplate={memoryConsentPrompt}
            />
          )}

          {aiConciergeEnabled && useSceneBannerUi && (
            <DenisSceneBanners
              banners={sceneBanners}
              onBannerAction={handleSceneBannerAction}
              onDismiss={() => setSceneRefreshKey((key) => key + 1)}
            />
          )}

          {!aiConciergeEnabled && !useSceneBannerUi && (
            <AiSmartNudgeBanner
              nudge={activeNudge}
              orderingDisabled={!canPlaceOrders}
              onAction={handleNudgeAction}
              onAdd={handleNudgeAdd}
              onDismiss={dismissNudge}
            />
          )}

          <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500 sm:start-4" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tUI("menu.search")}
                  className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-3 ps-10 pe-4 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-700 sm:py-2.5 sm:text-sm"
                />
              </div>
            </div>
            {!filtered && (
              <>
                <CategoryPills
                  categories={filteredCategories}
                  activeCategory={activeCategory}
                  onSelect={scrollToCategory}
                />
                <AllergenFilter
                  excluded={excluded}
                  onToggle={toggle}
                  onClear={clear}
                />
              </>
            )}
          </div>


          {!filtered &&
            !aiConciergeEnabled &&
            aiActive &&
            showRecommendedSection &&
            aiRecommendations.length > 0 && (
              <AiRecommendedSection
                recommendations={aiRecommendations}
                currency={currency}
                orderingDisabled={!canPlaceOrders}
                onAdd={handleAddAiRecommendation}
                onDismiss={() => setShowRecommendedSection(false)}
                onReset={resetAiRecommendations}
              />
            )}

          <main ref={menuMainRef} className="px-3 py-4 sm:px-4 sm:py-6">
            {hiddenByAllergenCount > 0 && (
              <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
                {tUI("allergen.hiddenCount", { count: hiddenByAllergenCount })}
              </p>
            )}
            {filtered ? (
              <div>
                {filtered.length === 0 ? (
                  <p className="py-12 text-center text-zinc-400">
                    {tUI("menu.noResults", { query: searchQuery })}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--qr-elevated)]/80">
                    {filtered.map((product) => (
                      <MenuListItem
                        key={product.id}
                        product={product}
                        currency={currency}
                        menuSection={
                          menuSectionByProductId.get(product.id) ?? "food"
                        }
                        orderingDisabled={!canPlaceOrders}
                        onOpenDetail={() => openProductDetail(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MenuGrid
                categories={filteredCategories}
                unavailableCategories={allUnavailableCategories}
                currency={currency}
                orderingDisabled={!canPlaceOrders}
                onOpenDetail={openProductDetail}
                aiReasonByProductId={aiReasonByProductId}
              />
            )}

            <div className="mt-8 flex flex-col gap-4 pb-4">
              {showFeedback && feedbackOrder && (
                <div className="px-1">
                  <p className="mb-2 text-center text-xs text-zinc-500">
                    {tUI("ai.feedback.onMenuHint")}
                  </p>
                  <AiFeedbackPrompt
                    orderId={feedbackOrder.id}
                    sessionToken={sessionToken!}
                    deliveredAt={feedbackOrder.delivered_at}
                    googleReviewUrl={googleReviewUrl}
                  />
                </div>
              )}
              <div className="flex justify-center">
                <CallWaiterButton token={token} tableName={tableName} />
              </div>
            </div>
          </main>

          {orderingEnabled && (
            <>
              {pairingRecommendation &&
                !hasDrinkInCart &&
                activeNudge?.kind !== "drink_pairing" && (
                <AiCartPairingBanner
                  recommendation={pairingRecommendation}
                  currency={currency}
                  orderingDisabled={!canPlaceOrders}
                  onAdd={handleAddPairing}
                  onDismiss={() => setPairingRecommendation(null)}
                />
              )}
              {!detailProduct && !aiChatOpen && (
                <CartSummaryBar
                  slug={slug}
                  token={token}
                  taxPercent={taxPercent}
                  currency={currency}
                  glowOnMount={returnGlow}
                />
              )}
            </>
          )}

          <ProductDetailSheet
            product={detailProduct}
            currency={currency}
            orderingDisabled={!canPlaceOrders}
            menuSection={
              detailProduct
                ? menuSectionByProductId.get(detailProduct.id) ?? "food"
                : "food"
            }
            open={!!detailProduct}
            onOpenChange={(o) => !o && setDetailProduct(null)}
          />

          {aiConciergeEnabled && (
            <AiConciergeChat
              open={aiChatOpen}
              onOpenChange={handleAiChatOpenChange}
              onSceneRefresh={handleGuestSceneRefresh}
              onOpenPaymentSheet={() => setBillSheetOpen(true)}
              sceneChrome={scene?.chrome ?? null}
              slug={slug}
              token={token}
              locationId={locationId}
              tableId={tableId}
              sessionToken={sessionToken}
              currency={currency}
              taxPercent={taxPercent}
              orderingDisabled={!canPlaceOrders}
              isDemo={isDemoGuestRoute(slug, token)}
              menuCategories={menuCategories}
              menuSectionByProductId={menuSectionByProductIdAll}
              productTaxRateById={
                new Map(
                  [...productById.values()].map((p) => [
                    p.id,
                    p.tax_rate != null ? Number(p.tax_rate) : null,
                  ])
                )
              }
              scrollContext={getAiContext}
              guestProfile={profile}
              isReturning={isReturning}
              onAddToCart={handleAddAiRecommendation}
              customizableProductIds={customizableProductIds}
              onOpenProductDetail={(productId) => {
                const product = productById.get(productId);
                if (product) openProductDetail(product);
              }}
              onRecommendations={handleAiChatSetupComplete}
              onSaveAllergies={saveGuestAllergies}
              getManualCartSnapshot={getManualCartSnapshot}
              deviceFingerprint={deviceFingerprint}
              voiceEnabled={voiceEnabled}
              voiceTtsEnabled={voiceTtsEnabled}
              bootstrapTranscript={denisView?.transcript ?? null}
            />
          )}

        </div>
      </PullToRefresh>

      {aiConciergeEnabled && !aiChatOpen && (
        <DenisGuestDock
          scene={scene}
          currency={currency}
          tableName={tableName}
          venueName={locationName}
          loading={Boolean(sessionToken) && sceneLoading && !scene}
          cartBarVisible={
            orderingEnabled && !detailProduct && itemCount > 0
          }
          headline={
            denisView
              ? denisView.chrome.headline
              : scene?.chrome.situation?.headline
          }
          subtitle={
            scene?.chrome.situation?.headline ??
            welcomeBackMessage ??
            undefined
          }
          onOpenDesk={handleOpenDenisDesk}
          onChipPress={handleSceneChipPress}
          onInlineAdd={handleSceneInlineAdd}
          onOrderPress={handleOrderPress}
          busy={sceneTurnBusy}
        />
      )}

      {sessionToken ? (
        <>
          <GuestOrderFocusSheet
            open={focusOrderId != null}
            onOpenChange={(open) => {
              if (!open) setFocusOrderId(null);
            }}
            orderId={focusOrderId}
            slug={slug}
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
          />
          <GuestSessionBillSheet
            open={billSheetOpen}
            onOpenChange={setBillSheetOpen}
            slug={slug}
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
          />
        </>
      ) : null}
    </>
  );
}
