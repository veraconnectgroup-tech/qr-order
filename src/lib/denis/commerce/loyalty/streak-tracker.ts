export type StreakTier = 0 | 2 | 4;

export type StreakResult = {
  tier: StreakTier;
  visitCountInWindow: number;
  windowDays: number;
  multiplier: number;
  label: string;
  isBroken: boolean;
};

const MS_PER_DAY = 86_400_000;

export function detectStreak(
  visitDates: string[],
  now = new Date()
): StreakResult {
  const nowMs = now.getTime();
  const sorted = [...visitDates]
    .map((iso) => new Date(iso).getTime())
    .filter((ms) => !Number.isNaN(ms))
    .sort((a, b) => b - a);

  if (sorted.length === 0) {
    return {
      tier: 0,
      visitCountInWindow: 0,
      windowDays: 0,
      multiplier: 1,
      label: "",
      isBroken: false,
    };
  }

  const visitsIn30 = sorted.filter((ms) => nowMs - ms <= 30 * MS_PER_DAY).length;
  const visitsIn14 = sorted.filter((ms) => nowMs - ms <= 14 * MS_PER_DAY).length;
  const daysSinceLast = Math.floor((nowMs - sorted[0]!) / MS_PER_DAY);

  if (visitsIn30 >= 4) {
    return {
      tier: 4,
      visitCountInWindow: visitsIn30,
      windowDays: 30,
      multiplier: 2,
      label: "🔥🔥 streak x4",
      isBroken: false,
    };
  }

  if (visitsIn14 >= 2) {
    return {
      tier: 2,
      visitCountInWindow: visitsIn14,
      windowDays: 14,
      multiplier: 1.5,
      label: "🔥 streak x2",
      isBroken: false,
    };
  }

  const isBroken = daysSinceLast > 30 && sorted.length >= 2;

  return {
    tier: 0,
    visitCountInWindow: visitsIn14,
    windowDays: 14,
    multiplier: 1,
    label: "",
    isBroken,
  };
}

export function pointsMultiplierFromStreak(tier: StreakTier): number {
  if (tier === 4) return 2;
  if (tier === 2) return 1.5;
  return 1;
}

export function buildStreakBreakMessage(language?: string): string {
  const lang = (language ?? "sr").slice(0, 2);
  if (lang === "en") {
    return "We miss you! Come back for bonus points.";
  }
  return "Nedostajete nam! Vratite se za bonus poene.";
}
