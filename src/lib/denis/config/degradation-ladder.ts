import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type DegradationLevel =
  | "full"
  | "reduced"
  | "essential"
  | "fallback"
  | "offline";

export const DEGRADATION_LEVEL_ORDER: readonly DegradationLevel[] = [
  "full",
  "reduced",
  "essential",
  "fallback",
  "offline",
] as const;

export type DegradationHealthInput = {
  avgResponseMs: number;
  llmErrorRate: number;
  uptimePercent: number;
  activeSessionCount: number;
  stuckSessions: string[];
};

export type DegradationResolution = {
  level: DegradationLevel;
  reason: string;
  disabledFeatures: string[];
  staffMessage: string;
};

export const DEGRADATION_THRESHOLDS = {
  reducedAvgResponseMs: 5_000,
  reducedLlmErrorRate: 0.05,
  essentialAvgResponseMs: 10_000,
  essentialLlmErrorRate: 0.2,
  fallbackAvgResponseMs: 20_000,
  fallbackLlmErrorRate: 0.5,
} as const;

/** Recovery must be stable at current level before stepping up (V2 hysteresis). */
export const DEGRADATION_RECOVERY_STABLE_MS: Record<DegradationLevel, number> = {
  full: 0,
  reduced: 10 * 60_000,
  essential: 5 * 60_000,
  fallback: 3 * 60_000,
  offline: 60_000,
};

const DISABLED_BY_LEVEL: Record<DegradationLevel, readonly string[]> = {
  full: [],
  reduced: ["proactive_nudges", "upsell", "scene_intelligence"],
  essential: [
    "proactive_nudges",
    "upsell",
    "scene_intelligence",
    "menu_personalization",
    "reorder",
    "tips",
  ],
  fallback: [
    "proactive_nudges",
    "upsell",
    "scene_intelligence",
    "menu_personalization",
    "reorder",
    "tips",
    "llm",
  ],
  offline: [
    "denis",
    "proactive_nudges",
    "upsell",
    "scene_intelligence",
    "menu_personalization",
    "reorder",
    "tips",
    "llm",
  ],
};

const STAFF_MESSAGE: Record<DegradationLevel, string> = {
  full: "Denis radi normalno.",
  reduced: "Denis radi sporije, osnovne funkcije aktivne.",
  essential: "Denis samo prima narudžbe.",
  fallback: "Denis na autopilotu — samo basic narudžbe.",
  offline: "Denis privremeno nedostupan — gosti vide statični meni.",
};

export type DegradationFeatureId =
  | "proactive_nudges"
  | "upsell"
  | "scene_intelligence"
  | "menu_personalization"
  | "reorder"
  | "tips"
  | "llm"
  | "denis";

export function isDegradationFeatureDisabled(
  level: DegradationLevel,
  featureId: DegradationFeatureId | string
): boolean {
  return DISABLED_BY_LEVEL[level].includes(featureId);
}

export function degradationAllowsLlm(level: DegradationLevel): boolean {
  return !isDegradationFeatureDisabled(level, "llm");
}

export function degradationLevelIndex(level: DegradationLevel): number {
  return DEGRADATION_LEVEL_ORDER.indexOf(level);
}

export function isSystemUnresponsive(metrics: DegradationHealthInput): boolean {
  if (metrics.uptimePercent > 0 && metrics.uptimePercent < 0.5) {
    return true;
  }
  if (metrics.avgResponseMs > 45_000 && metrics.llmErrorRate > 0.8) {
    return true;
  }
  return (
    metrics.activeSessionCount > 0 &&
    metrics.stuckSessions.length >= metrics.activeSessionCount &&
    metrics.avgResponseMs > 30_000
  );
}

/** Immediate target from live metrics — may be multiple steps from current. */
export function resolveTargetDegradationLevel(
  metrics: DegradationHealthInput
): DegradationLevel {
  if (isSystemUnresponsive(metrics)) return "offline";
  if (
    metrics.avgResponseMs > DEGRADATION_THRESHOLDS.fallbackAvgResponseMs ||
    metrics.llmErrorRate > DEGRADATION_THRESHOLDS.fallbackLlmErrorRate
  ) {
    return "fallback";
  }
  if (
    metrics.avgResponseMs > DEGRADATION_THRESHOLDS.essentialAvgResponseMs ||
    metrics.llmErrorRate > DEGRADATION_THRESHOLDS.essentialLlmErrorRate
  ) {
    return "essential";
  }
  if (
    metrics.avgResponseMs > DEGRADATION_THRESHOLDS.reducedAvgResponseMs ||
    metrics.llmErrorRate > DEGRADATION_THRESHOLDS.reducedLlmErrorRate
  ) {
    return "reduced";
  }
  return "full";
}

function buildReason(
  level: DegradationLevel,
  metrics: DegradationHealthInput
): string {
  switch (level) {
    case "offline":
      return "system unresponsive — static menu fallback";
    case "fallback":
      return `avg ${metrics.avgResponseMs}ms or LLM errors ${(metrics.llmErrorRate * 100).toFixed(0)}% — T0 only`;
    case "essential":
      return `avg ${metrics.avgResponseMs}ms or LLM errors ${(metrics.llmErrorRate * 100).toFixed(0)}% — ordering only`;
    case "reduced":
      return `avg ${metrics.avgResponseMs}ms or LLM errors ${(metrics.llmErrorRate * 100).toFixed(0)}% — reduced features`;
    default:
      return "metrics within normal range";
  }
}

/** One ladder step toward target — never jump more than one level per call. */
export function stepDegradationLevel(input: {
  currentLevel: DegradationLevel;
  targetLevel: DegradationLevel;
  levelSince: number;
  now?: number;
}): DegradationLevel {
  const now = input.now ?? Date.now();
  const currentIdx = degradationLevelIndex(input.currentLevel);
  const targetIdx = degradationLevelIndex(input.targetLevel);

  if (targetIdx === currentIdx) return input.currentLevel;

  if (targetIdx > currentIdx) {
    return DEGRADATION_LEVEL_ORDER[currentIdx + 1]!;
  }

  const stableMs = now - input.levelSince;
  const requiredMs = DEGRADATION_RECOVERY_STABLE_MS[input.currentLevel];
  if (stableMs < requiredMs) {
    return input.currentLevel;
  }

  return DEGRADATION_LEVEL_ORDER[currentIdx - 1]!;
}

export function resolveDegradationLevel(input: {
  health: DegradationHealthInput;
  currentLevel: DegradationLevel;
  levelSince: number;
  config: ConciergeConfig;
  now?: number;
}): DegradationResolution {
  void input.config;

  const target = resolveTargetDegradationLevel(input.health);
  const level = stepDegradationLevel({
    currentLevel: input.currentLevel,
    targetLevel: target,
    levelSince: input.levelSince,
    now: input.now,
  });

  return {
    level,
    reason: buildReason(level, input.health),
    disabledFeatures: [...DISABLED_BY_LEVEL[level]],
    staffMessage: STAFF_MESSAGE[level],
  };
}

export function degradationForcesT0Only(level: DegradationLevel): boolean {
  return degradationLevelIndex(level) >= degradationLevelIndex("fallback");
}

export function degradationReducesProactive(level: DegradationLevel): boolean {
  return degradationLevelIndex(level) >= degradationLevelIndex("reduced");
}

export function degradationDenisOffline(level: DegradationLevel): boolean {
  return level === "offline";
}

export function degradationOpsPatch(level: DegradationLevel): {
  skipUpsell: boolean;
  shortenReplies: boolean;
  guestSafeStaffHint: string | null;
} {
  return {
    skipUpsell: degradationLevelIndex(level) >= degradationLevelIndex("reduced"),
    shortenReplies: level !== "full",
    guestSafeStaffHint:
      level === "full" ? null : "Denis je privremeno pojednostavljen — tu smo za narudžbu.",
  };
}

const OFFLINE_GUEST_MESSAGE: Record<string, string> = {
  en: "Denis is temporarily unavailable. Please order from the menu or call your waiter.",
  de: "Denis ist vorübergehend nicht verfügbar. Bitte bestellen Sie über die Speisekarte oder rufen Sie Ihren Kellner.",
  sr: "Denis je privremeno nedostupan. Naručite direktno iz menija ili pozovite konobara.",
};

/** Guest-safe copy when ladder reaches offline — no error surface. */
export function degradationGuestOfflineMessage(language: string): string {
  const key = language.trim().toLowerCase().slice(0, 2);
  return OFFLINE_GUEST_MESSAGE[key] ?? OFFLINE_GUEST_MESSAGE.en!;
}
