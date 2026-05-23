"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { MenuCategory } from "@/components/guest/menu-grid";
import { ProductRecommendationCard } from "@/components/guest/product-recommendation-card";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectProactiveTrigger,
  type ProactiveTriggerKind,
} from "@/lib/ai/proactive-triggers";
import type { AiChatRecommendation } from "@/lib/ai/parse-response";
import {
  readAiSessionId,
  trackAiConversion,
  writeAiSessionId,
} from "@/lib/ai/guest-session-storage";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import { useCart } from "@/hooks/use-cart";
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
import type { ProductWithModifiers } from "@/types";

type BannerState =
  | { phase: "idle" }
  | { phase: "loading"; kind: ProactiveTriggerKind }
  | {
      phase: "ready";
      kind: ProactiveTriggerKind;
      message: string;
      recommendations: AiChatRecommendation[];
      markShown: () => void;
    };

const STORAGE = {
  pairing: (orderId: string) => `ai-proactive-pairing-${orderId}`,
  dessert: (sessionToken: string) => `ai-proactive-dessert-${sessionToken}`,
  welcome: (sessionToken: string, visitTs: string) =>
    `ai-proactive-welcome-${sessionToken}-${visitTs}`,
  lastVisit: (slug: string, token: string) => `ai-menu-visit-${slug}-${token}`,
};

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

function readLastVisit(slug: string, token: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE.lastVisit(slug, token));
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastVisit(slug: string, token: string, ts: number) {
  try {
    sessionStorage.setItem(STORAGE.lastVisit(slug, token), String(ts));
  } catch {
    // ignore
  }
}

export function AiProactiveBanner({
  slug,
  token,
  locationId,
  tableId,
  sessionToken,
  currency,
  orders,
  aiConciergeEnabled,
  categories,
  orderingDisabled = false,
  onOpenProduct,
}: {
  slug: string;
  token: string;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  currency: string;
  orders: AiGuestOrder[];
  aiConciergeEnabled: boolean;
  categories: MenuCategory[];
  orderingDisabled?: boolean;
  onOpenProduct?: (product: ProductWithModifiers) => void;
}) {
  const { tUI, menuLocale, isEnglish } = useAppLocale();
  const addItem = useCart((s) => s.addItem);
  const [banner, setBanner] = useState<BannerState>({ phase: "idle" });
  const inFlight = useRef(false);
  const mountedAt = useRef(Date.now());

  const productById = useMemo(() => {
    const map = new Map<string, ProductWithModifiers>();
    for (const category of categories) {
      for (const product of category.products) {
        map.set(product.id, product);
      }
    }
    return map;
  }, [categories]);

  const menuSectionByProductId = useMemo(() => {
    const map = new Map<string, MenuSection>();
    for (const category of categories) {
      const section = inferMenuSection(category);
      for (const product of category.products) {
        map.set(product.id, section);
      }
    }
    return map;
  }, [categories]);

  const language = isEnglish ? "en" : menuLocale;

  const dismiss = useCallback(() => {
    if (banner.phase === "ready") {
      banner.markShown();
    }
    setBanner({ phase: "idle" });
  }, [banner]);

  const addRecommendation = useCallback(
    (rec: AiChatRecommendation) => {
      if (orderingDisabled) return;

      const product = productById.get(rec.productId);
      if (product && (product.modifier_groups?.length ?? 0) > 0) {
        onOpenProduct?.(product);
        return;
      }

      hapticClick();
      addItem({
        productId: rec.productId,
        productName: rec.name,
        unitPrice: rec.price,
        quantity: 1,
        notes: "",
        menuSection: menuSectionByProductId.get(rec.productId) ?? "food",
        productTaxRate:
          product?.tax_rate != null ? Number(product.tax_rate) : null,
        modifiers: [],
      });
    toastAddedToCart(rec.name, rec.price, currency);

    const storedSessionId =
      sessionToken && readAiSessionId(locationId, sessionToken);
    if (storedSessionId && sessionToken) {
      void trackAiConversion({
        sessionId: storedSessionId,
        productId: rec.productId,
        locationId,
        tableId,
        sessionToken,
      });
    }
  },
    [
      addItem,
      currency,
      menuSectionByProductId,
      onOpenProduct,
      orderingDisabled,
      productById,
    ]
  );

  useEffect(() => {
    if (!aiConciergeEnabled || !sessionToken || banner.phase !== "idle") {
      return;
    }

    const lastVisitMs = readLastVisit(slug, token);
    const trigger = detectProactiveTrigger(orders, {
      lastVisitMs,
      isPairingShown: (orderId) => readFlag(STORAGE.pairing(orderId)),
      isDessertShown: () => readFlag(STORAGE.dessert(sessionToken)),
      isWelcomeShown: (visitTimestamp) =>
        readFlag(STORAGE.welcome(sessionToken, visitTimestamp)),
    });

    if (!trigger || inFlight.current) return;

    inFlight.current = true;
    setBanner({ phase: "loading", kind: trigger.kind });

    void (async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            tableId,
            sessionToken,
            message: trigger.prompt,
            language,
            sessionId: readAiSessionId(locationId, sessionToken) ?? undefined,
            includeOrderContext: true,
          }),
        });

        if (!res.ok) {
          if (res.status === 402 || res.status === 403 || res.status === 429) {
            if (trigger.orderId) writeFlag(STORAGE.pairing(trigger.orderId));
            if (trigger.kind === "dessert") {
              writeFlag(STORAGE.dessert(sessionToken));
            }
            if (trigger.visitTimestamp) {
              writeFlag(
                STORAGE.welcome(sessionToken, trigger.visitTimestamp)
              );
            }
          }
          setBanner({ phase: "idle" });
          return;
        }

        const json = await res.json();
        const data = json.data as {
          message: string;
          recommendations: AiChatRecommendation[];
          sessionId: string;
        };

        if (data.sessionId) {
          writeAiSessionId(locationId, sessionToken, data.sessionId);
        }

        if (!data.recommendations?.length) {
          if (trigger.orderId) writeFlag(STORAGE.pairing(trigger.orderId));
          if (trigger.kind === "dessert") {
            writeFlag(STORAGE.dessert(sessionToken));
          }
          if (trigger.visitTimestamp) {
            writeFlag(
              STORAGE.welcome(sessionToken, trigger.visitTimestamp)
            );
          }
          setBanner({ phase: "idle" });
          return;
        }

        const markShown = () => {
          if (trigger.orderId) writeFlag(STORAGE.pairing(trigger.orderId));
          if (trigger.kind === "dessert") {
            writeFlag(STORAGE.dessert(sessionToken));
          }
          if (trigger.visitTimestamp) {
            writeFlag(
              STORAGE.welcome(sessionToken, trigger.visitTimestamp)
            );
          }
        };

        setBanner({
          phase: "ready",
          kind: trigger.kind,
          message: data.message,
          recommendations: data.recommendations,
          markShown,
        });
      } catch {
        setBanner({ phase: "idle" });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [
    aiConciergeEnabled,
    banner.phase,
    language,
    locationId,
    orders,
    sessionToken,
    slug,
    tableId,
    token,
  ]);

  useEffect(() => {
    writeLastVisit(slug, token, mountedAt.current);
    return () => {
      writeLastVisit(slug, token, Date.now());
    };
  }, [slug, token]);

  if (!aiConciergeEnabled || !sessionToken) return null;

  if (banner.phase === "loading") {
    return (
      <div className="mx-4 mb-2 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
        <div className="h-4 w-2/3 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-1/2 rounded bg-zinc-800/80" />
      </div>
    );
  }

  if (banner.phase !== "ready") return null;

  const primary = banner.recommendations[0];

  if (banner.kind === "pairing" && primary) {
    return (
      <div className="mx-4 mb-2 rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/20 via-zinc-900 to-zinc-900 px-4 py-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-orange-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              {tUI("ai.proactive.pairing", {
                name: primary.name,
                price: formatPrice(primary.price, currency),
              })}
            </p>
            {primary.reason && (
              <p className="mt-1 text-xs text-zinc-400">{primary.reason}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!orderingDisabled && (
              <button
                type="button"
                onClick={() => addRecommendation(primary)}
                className="flex size-9 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 active:scale-95"
                aria-label={tUI("ai.proactive.add", { name: primary.name })}
              >
                <Plus className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label={tUI("ai.proactive.dismiss")}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (banner.kind === "dessert") {
    return (
      <div className="mx-4 mb-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {tUI("ai.proactive.dessertTitle")}
            </p>
            {banner.message && (
              <p className="mt-1 text-xs text-zinc-400">{banner.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={tUI("ai.proactive.dismiss")}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {banner.recommendations.map((rec) => {
            const product = productById.get(rec.productId);
            const hasModifiers = (product?.modifier_groups?.length ?? 0) > 0;
            return (
              <ProductRecommendationCard
                key={rec.productId}
                recommendation={rec}
                currency={currency}
                menuSection={menuSectionByProductId.get(rec.productId) ?? "food"}
                productTaxRate={
                  product?.tax_rate != null ? Number(product.tax_rate) : null
                }
                orderingDisabled={orderingDisabled}
                onOpenDetail={
                  hasModifiers && onOpenProduct && product
                    ? () => onOpenProduct(product)
                    : undefined
                }
                conversionContext={
                  sessionToken && readAiSessionId(locationId, sessionToken)
                    ? {
                        sessionId: readAiSessionId(locationId, sessionToken)!,
                        locationId,
                        tableId,
                        sessionToken,
                      }
                    : undefined
                }
                className="w-64 shrink-0"
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 rounded-xl border border-orange-500/20 bg-zinc-900 px-4 py-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {banner.message || tUI("ai.proactive.welcomeTitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label={tUI("ai.proactive.dismiss")}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {banner.recommendations.map((rec) => {
          const product = productById.get(rec.productId);
          const hasModifiers = (product?.modifier_groups?.length ?? 0) > 0;
          return (
            <ProductRecommendationCard
              key={rec.productId}
              recommendation={rec}
              currency={currency}
              menuSection={menuSectionByProductId.get(rec.productId) ?? "food"}
              productTaxRate={
                product?.tax_rate != null ? Number(product.tax_rate) : null
              }
              orderingDisabled={orderingDisabled}
              onOpenDetail={
                hasModifiers && onOpenProduct && product
                  ? () => onOpenProduct(product)
                  : undefined
              }
              conversionContext={
                sessionToken && readAiSessionId(locationId, sessionToken)
                  ? {
                      sessionId: readAiSessionId(locationId, sessionToken)!,
                      locationId,
                      tableId,
                      sessionToken,
                    }
                  : undefined
              }
              className="w-64 shrink-0"
            />
          );
        })}
      </div>
    </div>
  );
}
