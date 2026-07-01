export type GuestAccessibilityMode =
  | "visual"
  | "voice"
  | "simplified"
  | "default";

export type GuestAccessibilityPrefs = {
  preferredMode: GuestAccessibilityMode;
  fontScale: number;
  highContrast: boolean;
  reducedMotion: boolean;
};

export const DEFAULT_GUEST_ACCESSIBILITY: GuestAccessibilityPrefs = {
  preferredMode: "default",
  fontScale: 1,
  highContrast: false,
  reducedMotion: false,
};

export type { ClientAccessibilitySignals } from "@/lib/denis/platform/accessibility-signals";

export type SceneAccessibility = GuestAccessibilityPrefs & {
  chipMinHeightPx: number;
  tapTargetMinPx: number;
  autoTts: boolean;
  maxReplySentences: number;
  simplifiedMenu: boolean;
  suppressProactiveNudges: boolean;
};

export function toSceneAccessibility(
  prefs: GuestAccessibilityPrefs
): SceneAccessibility {
  const simplified =
    prefs.preferredMode === "simplified" || prefs.preferredMode === "voice";
  const large =
    prefs.fontScale >= 1.25 || prefs.highContrast || simplified;

  return {
    ...prefs,
    chipMinHeightPx: Math.max(48, large ? 56 : 48),
    tapTargetMinPx: Math.max(48, large ? 56 : 48),
    autoTts: prefs.preferredMode === "voice",
    maxReplySentences: simplified ? 2 : 4,
    simplifiedMenu: simplified,
    suppressProactiveNudges: simplified || prefs.preferredMode === "voice",
  };
}

/** CSS hooks for guest-theme wrapper. */
export function guestAccessibilityClassNames(
  prefs: SceneAccessibility | GuestAccessibilityPrefs
): string {
  const scene = "chipMinHeightPx" in prefs ? prefs : toSceneAccessibility(prefs);
  const classes: string[] = [];
  if (scene.fontScale >= 1.25) classes.push("guest-a11y-large-text");
  if (scene.highContrast) classes.push("guest-a11y-high-contrast");
  if (scene.simplifiedMenu) classes.push("guest-a11y-simplified");
  if (scene.reducedMotion) classes.push("guest-a11y-reduced-motion");
  if (scene.tapTargetMinPx >= 48) classes.push("guest-a11y-large-touch");
  return classes.join(" ");
}

export function guestAccessibilityStyle(
  prefs: SceneAccessibility | GuestAccessibilityPrefs
): Record<string, string> {
  const scene = "chipMinHeightPx" in prefs ? prefs : toSceneAccessibility(prefs);
  return {
    "--guest-font-scale": String(scene.fontScale),
    "--guest-chip-min-height": `${scene.chipMinHeightPx}px`,
    "--guest-tap-min": `${scene.tapTargetMinPx}px`,
  };
}

const A11Y_MODIFIER_PREFIX = "__a11y:";

export function encodeAccessibilityModifier(
  prefs: GuestAccessibilityPrefs
): string {
  return `${A11Y_MODIFIER_PREFIX}${JSON.stringify(prefs)}`;
}

export function decodeAccessibilityFromModifiers(
  modifiers: string[] | null | undefined
): GuestAccessibilityPrefs | null {
  if (!modifiers?.length) return null;
  const token = modifiers.find((entry) => entry.startsWith(A11Y_MODIFIER_PREFIX));
  if (!token) return null;

  try {
    const parsed = JSON.parse(
      token.slice(A11Y_MODIFIER_PREFIX.length)
    ) as Partial<GuestAccessibilityPrefs>;
    return mergeAccessibilityPrefs(DEFAULT_GUEST_ACCESSIBILITY, parsed);
  } catch {
    return null;
  }
}

export function mergeAccessibilityPrefs(
  base: GuestAccessibilityPrefs,
  patch: Partial<GuestAccessibilityPrefs> | null | undefined
): GuestAccessibilityPrefs {
  if (!patch) return base;

  return {
    preferredMode: patch.preferredMode ?? base.preferredMode,
    fontScale: clampFontScale(patch.fontScale ?? base.fontScale),
    highContrast: patch.highContrast ?? base.highContrast,
    reducedMotion: patch.reducedMotion ?? base.reducedMotion,
  };
}

function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(1, Math.round(value * 100) / 100));
}
