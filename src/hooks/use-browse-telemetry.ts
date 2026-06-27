"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { MenuCategory } from "@/components/guest/menu-grid";
import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { buildBrowseEvent } from "@/lib/guest/build-browse-event";
import { postBrowseTelemetry } from "@/lib/guest/post-browse-telemetry";
import { inferMenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";
import type { CartItem } from "@/hooks/use-cart";

const VIEW_THRESHOLD_MS = 1_500;
const INTERSECTION_THRESHOLD = 0.55;
const FLUSH_DEBOUNCE_MS = 450;

type ProductContext = {
  productId: string;
  productName: string;
  categoryId: string;
  categoryLabel: string;
  menuSection: ReturnType<typeof inferMenuSection>;
};

export type UseBrowseTelemetryOptions = {
  enabled: boolean;
  tableToken: string;
  tableSessionToken?: string;
  locationId: string;
  tableId: string;
  aiSessionId?: string | null;
  deviceFingerprint?: string | null;
  categories: MenuCategory[];
  containerRef?: RefObject<HTMLElement | null>;
  activeCategoryId: string;
  detailProduct: ProductWithModifiers | null;
  cartItems: CartItem[];
  cartBump: number;
};

function countByProductId(items: CartItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.productId, (counts.get(item.productId) ?? 0) + item.quantity);
  }
  return counts;
}

export function useBrowseTelemetry(options: UseBrowseTelemetryOptions) {
  const queueRef = useRef<BrowseEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const flushingRef = useRef(false);
  const productContextRef = useRef<Map<string, ProductContext>>(new Map());
  const categoryByIdRef = useRef<Map<string, MenuCategory>>(new Map());
  const prevCategoryRef = useRef<{ id: string; enteredAt: number } | null>(null);
  const detailOpenedAtRef = useRef<number | null>(null);
  const prevCartCountsRef = useRef<Map<string, number>>(new Map());
  const cartInitializedRef = useRef(false);

  const enqueue = useCallback(
    (event: BrowseEvent) => {
      if (!options.enabled) return;
      queueRef.current.push(event);

      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void (async () => {
          if (flushingRef.current) return;
          flushingRef.current = true;
          try {
            while (queueRef.current.length > 0) {
              const event = queueRef.current.shift();
              if (!event) continue;
              await postBrowseTelemetry({
                tableToken: options.tableToken,
                tableSessionToken: options.tableSessionToken,
                locationId: options.locationId,
                tableId: options.tableId,
                aiSessionId: options.aiSessionId,
                deviceFingerprint: options.deviceFingerprint,
                event,
              }).catch(() => {
                // non-blocking — guest menu must not break on telemetry failure
              });
            }
          } finally {
            flushingRef.current = false;
          }
        })();
      }, FLUSH_DEBOUNCE_MS);
    },
    [
      options.enabled,
      options.tableToken,
      options.tableSessionToken,
      options.locationId,
      options.tableId,
      options.aiSessionId,
      options.deviceFingerprint,
    ]
  );

  useEffect(() => {
    const productMap = new Map<string, ProductContext>();
    const categoryMap = new Map<string, MenuCategory>();

    for (const category of options.categories) {
      categoryMap.set(category.id, category);
      const menuSection = inferMenuSection(category);
      const categoryLabel = category.name_en?.trim() || category.name;
      for (const product of category.products) {
        productMap.set(product.id, {
          productId: product.id,
          productName: product.name,
          categoryId: category.id,
          categoryLabel,
          menuSection,
        });
      }
    }

    productContextRef.current = productMap;
    categoryByIdRef.current = categoryMap;
  }, [options.categories]);

  const emitCategoryView = useCallback(
    (categoryId: string, dwellMs: number) => {
      const category = categoryByIdRef.current.get(categoryId);
      if (!category || dwellMs < VIEW_THRESHOLD_MS) return;

      enqueue(
        buildBrowseEvent({
          action: "view_category",
          categoryId: category.id,
          categoryLabel: category.name_en?.trim() || category.name,
          menuSection: inferMenuSection(category),
          dwellMs,
        })
      );
    },
    [enqueue]
  );

  useEffect(() => {
    if (!options.enabled) return;

    const now = Date.now();
    const prev = prevCategoryRef.current;

    if (prev && prev.id !== options.activeCategoryId) {
      emitCategoryView(prev.id, now - prev.enteredAt);
    }

    prevCategoryRef.current = {
      id: options.activeCategoryId,
      enteredAt: now,
    };
  }, [options.enabled, options.activeCategoryId, emitCategoryView]);

  const detailProductIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!options.enabled) return;

    const product = options.detailProduct;
    if (product) {
      detailProductIdRef.current = product.id;
      detailOpenedAtRef.current = Date.now();
      return;
    }

    const productId = detailProductIdRef.current;
    detailProductIdRef.current = null;
    const openedAt = detailOpenedAtRef.current;
    detailOpenedAtRef.current = null;
    if (!productId || openedAt == null) return;

    const ctx = productContextRef.current.get(productId);
    if (!ctx) return;

    const dwellMs = Date.now() - openedAt;
    if (dwellMs < VIEW_THRESHOLD_MS) return;

    enqueue(
      buildBrowseEvent({
        action: "view_product",
        productId: ctx.productId,
        productName: ctx.productName,
        categoryId: ctx.categoryId,
        categoryLabel: ctx.categoryLabel,
        menuSection: ctx.menuSection,
        dwellMs,
      })
    );
  }, [options.enabled, options.detailProduct, enqueue]);

  useEffect(() => {
    if (!options.enabled) return;

    const visibleSince = new Map<string, number>();
    const root = options.containerRef?.current ?? null;

    const emitProductView = (productId: string, dwellMs: number) => {
      const ctx = productContextRef.current.get(productId);
      if (!ctx || dwellMs < VIEW_THRESHOLD_MS) return;

      enqueue(
        buildBrowseEvent({
          action: "view_product",
          productId: ctx.productId,
          productName: ctx.productName,
          categoryId: ctx.categoryId,
          categoryLabel: ctx.categoryLabel,
          menuSection: ctx.menuSection,
          dwellMs,
        })
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const productId = entry.target.getAttribute("data-product-id");
          if (!productId) continue;

          if (entry.isIntersecting) {
            if (!visibleSince.has(productId)) {
              visibleSince.set(productId, now);
            }
          } else {
            const since = visibleSince.get(productId);
            visibleSince.delete(productId);
            if (since != null) {
              emitProductView(productId, now - since);
            }
          }
        }
      },
      { root, threshold: INTERSECTION_THRESHOLD }
    );

    const observeCards = () => {
      const scope = root ?? document;
      scope.querySelectorAll("[data-product-id]").forEach((el) => {
        observer.observe(el);
      });
    };

    observeCards();

    const mutationTarget = root ?? document.body;
    const mutationObserver = new MutationObserver(() => {
      observer.disconnect();
      visibleSince.clear();
      observeCards();
    });

    mutationObserver.observe(mutationTarget, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      visibleSince.clear();
    };
  }, [options.enabled, options.containerRef, enqueue]);

  useEffect(() => {
    if (!options.enabled) return;

    const current = countByProductId(options.cartItems);
    if (!cartInitializedRef.current) {
      prevCartCountsRef.current = current;
      cartInitializedRef.current = true;
      return;
    }

    const prev = prevCartCountsRef.current;
    prevCartCountsRef.current = current;

    for (const [productId, qty] of current) {
      const before = prev.get(productId) ?? 0;
      if (qty > before) {
        const ctx = productContextRef.current.get(productId);
        const cartLine = options.cartItems.find((i) => i.productId === productId);
        const addedQty = qty - before;
        const unitTotal =
          cartLine && cartLine.quantity > 0
            ? cartLine.itemTotal / cartLine.quantity
            : undefined;
        enqueue(
          buildBrowseEvent({
            action: "add_to_cart",
            productId,
            productName: ctx?.productName ?? cartLine?.productName,
            categoryId: ctx?.categoryId,
            categoryLabel: ctx?.categoryLabel,
            menuSection: ctx?.menuSection,
            lineTotal:
              unitTotal != null && Number.isFinite(unitTotal)
                ? unitTotal * addedQty
                : cartLine?.itemTotal,
          })
        );
      }
    }

    for (const [productId, qty] of prev) {
      const after = current.get(productId) ?? 0;
      if (qty > after) {
        const ctx = productContextRef.current.get(productId);
        enqueue(
          buildBrowseEvent({
            action: "remove_from_cart",
            productId,
            productName: ctx?.productName,
            categoryId: ctx?.categoryId,
            categoryLabel: ctx?.categoryLabel,
            menuSection: ctx?.menuSection,
          })
        );
      }
    }
  }, [options.enabled, options.cartItems, options.cartBump, enqueue]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
      const prev = prevCategoryRef.current;
      if (options.enabled && prev) {
        emitCategoryView(prev.id, Date.now() - prev.enteredAt);
      }
    };
  }, [options.enabled, emitCategoryView]);
}
