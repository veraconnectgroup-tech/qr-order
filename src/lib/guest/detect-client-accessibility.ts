import type { ClientAccessibilitySignals } from "@/lib/denis/cognition/mental-model/accessibility-types";

const SCREEN_READER_UA =
  /VoiceOver|NVDA|JAWS|TalkBack|Orca|Narrator|Window-Eyes|ZoomText/i;

/** Heuristic screen reader detection — client-only. */
export function detectScreenReaderActive(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (SCREEN_READER_UA.test(navigator.userAgent)) return true;

  try {
    if (window.matchMedia("(forced-colors: active)").matches) return true;
  } catch {
    // ignore
  }

  return false;
}

/** Collect browser accessibility signals for Denis fold (U3). */
export function detectClientAccessibilitySignals(): ClientAccessibilitySignals {
  if (typeof window === "undefined") return {};

  const screenReader = detectScreenReaderActive();
  let prefersReducedMotion = false;
  let coarsePointer = false;

  try {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    // ignore
  }

  const inner = window.innerWidth || 1;
  const outer = window.outerWidth || inner;
  const browserZoom = Math.round((outer / inner) * 10) / 10;

  return {
    screenReader,
    prefersReducedMotion,
    coarsePointer,
    browserZoom: browserZoom >= 1.25 ? browserZoom : undefined,
  };
}
