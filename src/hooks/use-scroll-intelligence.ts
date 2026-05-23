"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const VIEW_THRESHOLD_MS = 1_500;
const INTERSECTION_THRESHOLD = 0.55;

export function useScrollIntelligence(
  productNames: Map<string, string>,
  options?: {
    enabled?: boolean;
    containerRef?: RefObject<HTMLElement | null>;
    hasOrdered?: boolean;
  }
) {
  const enabled = options?.enabled ?? true;
  const viewCountsRef = useRef<Map<string, number>>(new Map());
  const browseStartedRef = useRef(Date.now());
  const pendingTimersRef = useRef<Map<string, number>>(new Map());

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

    const orderNote = options?.hasOrdered ? "Već je naručio." : "Nije naručio.";

    return `Gost gleda meni ${minutes} min. Najgledanije: ${topSummary}. ${orderNote}`;
  }, [getBrowseMinutes, productNames, options?.hasOrdered]);

  return { getAiContext, browseMinutes };
}
