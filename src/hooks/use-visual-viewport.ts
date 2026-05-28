"use client";

import { useLayoutEffect, useState } from "react";

export type VisualViewportState = {
  height: number;
  offsetTop: number;
  width: number;
  offsetLeft: number;
};

function readVisualViewport(): VisualViewportState | null {
  if (typeof window === "undefined") return null;
  const vv = window.visualViewport;
  if (!vv) return null;
  return {
    height: vv.height,
    offsetTop: vv.offsetTop,
    width: vv.width,
    offsetLeft: vv.offsetLeft,
  };
}

function syncVisualViewportCss(state: VisualViewportState | null) {
  const root = document.documentElement;
  if (!state) {
    root.style.removeProperty("--visual-viewport-height");
    root.style.removeProperty("--visual-viewport-offset-top");
    root.style.removeProperty("--visual-viewport-width");
    root.style.removeProperty("--visual-viewport-offset-left");
    return;
  }
  root.style.setProperty("--visual-viewport-height", `${state.height}px`);
  root.style.setProperty("--visual-viewport-offset-top", `${state.offsetTop}px`);
  root.style.setProperty("--visual-viewport-width", `${state.width}px`);
  root.style.setProperty("--visual-viewport-offset-left", `${state.offsetLeft}px`);
}

/**
 * Tracks window.visualViewport — needed on iOS Safari when the keyboard
 * opens over a fixed overlay (layout viewport stays full-screen).
 */
export function useVisualViewport(enabled = true): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(() =>
    enabled ? readVisualViewport() : null
  );

  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setState(null);
      syncVisualViewportCss(null);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const next = readVisualViewport();
      setState(next);
      syncVisualViewportCss(next);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focusin", sync);
    window.addEventListener("focusout", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focusin", sync);
      window.removeEventListener("focusout", sync);
      syncVisualViewportCss(null);
    };
  }, [enabled]);

  return enabled ? state : null;
}
