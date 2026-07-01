"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MenuCategory } from "@/components/guest/menu-grid";
import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { inferMenuSection } from "@/lib/menu-section";
import {
  buildScrollBrowseEvent,
  detectScrollIntentFromSample,
  SCROLL_BOTTOM_THRESHOLD_PX,
  type ScrollIntentKind,
  type ScrollSignal,
} from "@/lib/guest/scroll-intelligence";

const VIEW_THRESHOLD_MS = 1_500;
const INTERSECTION_THRESHOLD = 0.55;
const SCROLL_SAMPLE_MS = 250;

type ProductNameSource = Map<string, string> | MenuCategory[];

function resolveProductNames(
  source: ProductNameSource,
  tName?: (product: { id: string; name: string }) => string
) {
  if (source instanceof Map) return source;
  const map = new Map<string, string>();
  for (const category of source) {
    for (const product of category.products) {
      map.set(product.id, tName ? tName(product) : product.name);
    }
  }
  return map;
}

export function useScrollIntelligence(
  source: ProductNameSource,
  options?: {
    enabled?: boolean;
    containerRef?: RefObject<HTMLElement | null>;
    hasOrdered?: boolean;
    activeCategoryId?: string;
    tName?: (product: { id: string; name: string }) => string;
    formatContext?: (parts: {
      minutes: number;
      topSummary: string;
      hasOrdered: boolean;
      scrollIntent?: ScrollIntentKind | null;
    }) => string;
    onScrollBrowseEvent?: (event: BrowseEvent) => void;
  }
) {
  const productNames = useMemo(
    () => resolveProductNames(source, options?.tName),
    [source, options?.tName]
  );
  const enabled = options?.enabled ?? true;
  const viewCountsRef = useRef<Map<string, number>>(new Map());
  const browseStartedRef = useRef(Date.now());
  const pendingTimersRef = useRef<Map<string, number>>(new Map());
  const categoryEnteredAtRef = useRef(Date.now());
  const lastScrollSampleRef = useRef<{ y: number; at: number } | null>(null);
  const bottomEmittedRef = useRef(false);
  const emittedIntentsRef = useRef<Set<ScrollIntentKind>>(new Set());

  const [latestScrollIntent, setLatestScrollIntent] =
    useState<ScrollIntentKind | null>(null);
  const [categoryViewCounts, setCategoryViewCounts] = useState<
    Record<string, number>
  >({});

  const categoryMeta = useMemo(() => {
    if (source instanceof Map) return new Map<string, MenuCategory>();
    return new Map(source.map((category) => [category.id, category]));
  }, [source]);

  const productCategoryRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    if (!(source instanceof Map)) {
      for (const category of source) {
        for (const product of category.products) {
          map.set(product.id, category.id);
        }
      }
    }
    productCategoryRef.current = map;
  }, [source]);

  useEffect(() => {
    categoryEnteredAtRef.current = Date.now();
  }, [options?.activeCategoryId]);

  const emitScrollSignal = useCallback(
    (signal: ScrollSignal) => {
      if (emittedIntentsRef.current.has(signal.intent)) return;
      emittedIntentsRef.current.add(signal.intent);
      setLatestScrollIntent(signal.intent);
      options?.onScrollBrowseEvent?.(buildScrollBrowseEvent({ signal }));
    },
    [options?.onScrollBrowseEvent]
  );

  useEffect(() => {
    if (!enabled) return;

    const root = options?.containerRef?.current ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-product-id");
          if (!id) continue;

          if (entry.isIntersecting) {
            if (pendingTimersRef.current.has(id)) continue;
            const timer = window.setTimeout(() => {
              viewCountsRef.current.set(
                id,
                (viewCountsRef.current.get(id) ?? 0) + 1
              );
              pendingTimersRef.current.delete(id);

              const categoryId = productCategoryRef.current.get(id);
              if (categoryId) {
                setCategoryViewCounts((current) => ({
                  ...current,
                  [categoryId]: (current[categoryId] ?? 0) + 1,
                }));
              }
            }, VIEW_THRESHOLD_MS);
            pendingTimersRef.current.set(id, timer);
          } else {
            const timer = pendingTimersRef.current.get(id);
            if (timer) {
              window.clearTimeout(timer);
              pendingTimersRef.current.delete(id);
            }
          }
        }
      },
      {
        root,
        threshold: INTERSECTION_THRESHOLD,
      }
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
      for (const timer of pendingTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      pendingTimersRef.current.clear();
      observeCards();
    });

    mutationObserver.observe(mutationTarget, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      for (const timer of pendingTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      pendingTimersRef.current.clear();
    };
  }, [enabled, options?.containerRef]);

  useEffect(() => {
    if (!enabled) return;

    const scrollTarget = options?.containerRef?.current ?? window;
    const readScrollY = () => {
      if (options?.containerRef?.current) {
        return options.containerRef.current.scrollTop;
      }
      return window.scrollY;
    };
    const readScrollHeight = () => {
      if (options?.containerRef?.current) {
        const el = options.containerRef.current;
        return el.scrollHeight - el.clientHeight;
      }
      return document.documentElement.scrollHeight - window.innerHeight;
    };

    const onScroll = () => {
      const now = Date.now();
      const y = readScrollY();
      const prev = lastScrollSampleRef.current;
      lastScrollSampleRef.current = { y, at: now };

      const categoryId = options?.activeCategoryId;
      const category = categoryId ? categoryMeta.get(categoryId) : undefined;
      const categoryDwellMs = now - categoryEnteredAtRef.current;
      const maxScroll = readScrollHeight();
      const atBottom = maxScroll > 0 && y >= maxScroll - SCROLL_BOTTOM_THRESHOLD_PX;

      let velocityPxPerSec = 0;
      if (prev) {
        const dt = Math.max(1, now - prev.at) / 1000;
        velocityPxPerSec = Math.abs(y - prev.y) / dt;
      }

      const signal = detectScrollIntentFromSample({
        velocityPxPerSec,
        categoryDwellMs,
        atBottom: atBottom && !bottomEmittedRef.current,
        categoryId,
        categoryLabel: category?.name,
        menuSection: category ? inferMenuSection(category) : null,
        now,
      });

      if (signal?.intent === "reached_bottom") {
        bottomEmittedRef.current = true;
      }
      if (signal) {
        emitScrollSignal(signal);
      }
    };

    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    const sampleId = window.setInterval(onScroll, SCROLL_SAMPLE_MS);

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.clearInterval(sampleId);
    };
  }, [
    enabled,
    options?.containerRef,
    options?.activeCategoryId,
    categoryMeta,
    emitScrollSignal,
  ]);

  const getBrowseMinutes = useCallback(() => {
    return Math.max(
      0,
      Math.floor((Date.now() - browseStartedRef.current) / 60_000)
    );
  }, []);

  const [browseMinutes, setBrowseMinutes] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const update = () => setBrowseMinutes(getBrowseMinutes());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [enabled, getBrowseMinutes]);

  const getAiContext = useCallback(() => {
    const minutes = getBrowseMinutes();
    const ranked = [...viewCountsRef.current.entries()].sort(
      (a, b) => b[1] - a[1]
    );

    const topSummary =
      ranked.length > 0
        ? ranked
            .slice(0, 5)
            .map(([id, count]) => {
              const name = productNames.get(id) ?? "Proizvod";
              return `${name} (${count}x)`;
            })
            .join(", ")
        : "—";

    const hasOrdered = options?.hasOrdered ?? false;

    if (options?.formatContext) {
      return options.formatContext({
        minutes,
        topSummary,
        hasOrdered,
        scrollIntent: latestScrollIntent,
      });
    }

    const orderNote = hasOrdered ? "Već je naručio." : "Nije naručio.";
    const scrollNote = latestScrollIntent
      ? ` Scroll signal: ${latestScrollIntent}.`
      : "";
    return `Gost gleda meni ${minutes} min. Najgledanije: ${topSummary}. ${orderNote}${scrollNote}`;
  }, [
    getBrowseMinutes,
    productNames,
    options?.hasOrdered,
    options?.formatContext,
    latestScrollIntent,
  ]);

  return {
    getAiContext,
    browseMinutes,
    latestScrollIntent,
    categoryViewCounts,
  };
}
