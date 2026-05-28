"use client";

import { useEffect, useState } from "react";

export type VisualViewportState = {
  height: number;
  offsetTop: number;
  width: number;
  offsetLeft: number;
};

/**
 * Tracks window.visualViewport — needed on iOS Safari when the keyboard
 * opens over a fixed overlay (layout viewport stays full-screen).
 */
export function useVisualViewport(enabled = true): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      setState({
        height: vv.height,
        offsetTop: vv.offsetTop,
        width: vv.width,
        offsetLeft: vv.offsetLeft,
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [enabled]);

  return state;
}
