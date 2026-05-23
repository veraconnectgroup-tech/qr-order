"use client";

import { useEffect, useRef, useState } from "react";

type InViewListener = () => void;

let inViewObserver: IntersectionObserver | null = null;
const inViewListeners = new Map<Element, InViewListener>();

function ensureInViewObserver() {
  if (inViewObserver || typeof window === "undefined") return;
  inViewObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        inViewListeners.get(entry.target)?.();
        inViewObserver?.unobserve(entry.target);
        inViewListeners.delete(entry.target);
      }
    },
    { rootMargin: "-80px 0px", threshold: 0 }
  );
}

/** Single shared IntersectionObserver for landing scroll reveals. */
export function useInViewOnce() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    if (typeof window === "undefined") {
      setVisible(true);
      return;
    }

    ensureInViewObserver();
    inViewListeners.set(el, () => setVisible(true));
    inViewObserver?.observe(el);

    return () => {
      inViewListeners.delete(el);
      inViewObserver?.unobserve(el);
    };
  }, [visible]);

  return { ref, visible };
}
