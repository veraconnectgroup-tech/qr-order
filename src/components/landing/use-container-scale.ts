"use client";

import { useEffect, useRef, useState } from "react";

type ScaleListener = (width: number) => void;

let scaleObserver: ResizeObserver | null = null;
const scaleListeners = new Map<Element, ScaleListener>();

function ensureScaleObserver() {
  if (scaleObserver || typeof window === "undefined") return;
  scaleObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      scaleListeners.get(entry.target)?.(entry.contentRect.width);
    }
  });
}

/** Shared ResizeObserver for all landing scaled previews. */
export function useContainerScale(
  designWidth: number,
  options?: { maxScale?: number }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const maxScale = options?.maxScale ?? Infinity;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const el = containerRef.current;
    if (!el) return;

    ensureScaleObserver();

    const update = (width: number) => {
      setScale(Math.min(width / designWidth, maxScale));
    };

    update(el.clientWidth);
    scaleListeners.set(el, update);
    scaleObserver?.observe(el);

    return () => {
      scaleListeners.delete(el);
      scaleObserver?.unobserve(el);
    };
  }, [designWidth, maxScale, ready]);

  return { containerRef, scale: ready ? scale : 1, ready };
}
