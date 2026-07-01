export type GuestLevelId = 1 | 2 | 3 | 4;

export type GuestLevelKey = "new" | "regular" | "vip" | "ambassador";

export type GuestLevelDefinition = {
  id: GuestLevelId;
  key: GuestLevelKey;
  name: string;
  badge: string;
  badgeLabel: string;
  minVisits: number;
  minTotalSpent: number;
  waitlistPriorityBoost: number;
  denisGreeting: string;
  denisTone: "formal" | "warm" | "vip" | "casual";
  perks: string[];
};

export const GUEST_LEVELS: readonly GuestLevelDefinition[] = [
  {
    id: 1,
    key: "new",
    name: "Novi gost",
    badge: "✨",
    badgeLabel: "New",
    minVisits: 1,
    minTotalSpent: 0,
    waitlistPriorityBoost: 0,
    denisGreeting:
      "Dobrodošli! Ja sam Denis, vaš digitalni konobar.",
    denisTone: "formal",
    perks: ["Full Denis experience"],
  },
  {
    id: 2,
    key: "regular",
    name: "Redovan",
    badge: "🌟",
    badgeLabel: "Regular",
    minVisits: 3,
    minTotalSpent: 0,
    waitlistPriorityBoost: 1,
    denisGreeting:
      "Lepo vas je ponovo videti!",
    denisTone: "warm",
    perks: ["Priority na waitlist (+1)"],
  },
  {
    id: 3,
    key: "vip",
    name: "VIP",
    badge: "💎",
    badgeLabel: "VIP",
    minVisits: 7,
    minTotalSpent: 200,
    waitlistPriorityBoost: 3,
    denisGreeting:
      "Naš VIP gost! Imam nešto posebno za vas danas...",
    denisTone: "vip",
    perks: [
      "Priority waitlist (+3)",
      "Desert on the house (1× mesečno)",
      "Secret menu access",
    ],
  },
  {
    id: 4,
    key: "ambassador",
    name: "Ambasador",
    badge: "👑",
    badgeLabel: "Ambassador",
    minVisits: 15,
    minTotalSpent: 500,
    waitlistPriorityBoost: 5,
    denisGreeting:
      "Dobar dan, ambasadore! Vaš omiljeni sto je spreman.",
    denisTone: "casual",
    perks: [
      "Max waitlist priority",
      "Mesečni surprise",
      "Exclusive events invite",
    ],
  },
] as const;

export type GuestLevelInput = {
  visitCount: number;
  totalSpent: number;
};

export type NextLevelProgress = {
  currentLevel: GuestLevelDefinition;
  nextLevel: GuestLevelDefinition | null;
  visitsRemaining: number;
  spendRemaining: number;
  progressPercent: number;
};

export type LevelUpEvent = {
  previousLevel: GuestLevelId;
  newLevel: GuestLevelId;
  celebrationMessage: string;
};

export function resolveGuestLevel(input: GuestLevelInput): GuestLevelDefinition {
  const visits = Math.max(0, input.visitCount);
  const spent = Math.max(0, input.totalSpent);

  if (visits >= 15 || spent >= 500) {
    return GUEST_LEVELS[3]!;
  }
  if (visits >= 7 || spent >= 200) {
    return GUEST_LEVELS[2]!;
  }
  if (visits >= 3) {
    return GUEST_LEVELS[1]!;
  }
  return GUEST_LEVELS[0]!;
}

export function resolveWaitlistPriorityBoost(level: GuestLevelId): number {
  return GUEST_LEVELS.find((row) => row.id === level)?.waitlistPriorityBoost ?? 0;
}

export function buildNextLevelProgress(input: GuestLevelInput): NextLevelProgress {
  const currentLevel = resolveGuestLevel(input);
  const nextLevel =
    GUEST_LEVELS.find((row) => row.id === currentLevel.id + 1) ?? null;

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      visitsRemaining: 0,
      spendRemaining: 0,
      progressPercent: 100,
    };
  }

  const visitsRemaining = Math.max(0, nextLevel.minVisits - input.visitCount);
  const spendRemaining = Math.max(0, nextLevel.minTotalSpent - input.totalSpent);

  const visitProgress =
    nextLevel.minVisits > 0
      ? Math.min(1, input.visitCount / nextLevel.minVisits)
      : 1;
  const spendProgress =
    nextLevel.minTotalSpent > 0
      ? Math.min(1, input.totalSpent / nextLevel.minTotalSpent)
      : 1;
  const progressPercent = Math.round(
    Math.max(visitProgress, spendProgress) * 100
  );

  return {
    currentLevel,
    nextLevel,
    visitsRemaining,
    spendRemaining,
    progressPercent,
  };
}

export function detectLevelUp(
  previousLevel: GuestLevelId,
  input: GuestLevelInput
): LevelUpEvent | null {
  const newLevel = resolveGuestLevel(input);
  if (newLevel.id <= previousLevel) return null;

  return {
    previousLevel,
    newLevel: newLevel.id,
    celebrationMessage: `Čestitam, postali ste ${newLevel.name}! 🎉`,
  };
}

export function buildReturningGuestGreeting(input: {
  level: GuestLevelDefinition;
  lastVisitItemNames?: string[];
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const lastItems = input.lastVisitItemNames?.filter(Boolean).slice(0, 2) ?? [];

  if (input.level.id === 1) {
    return lang === "en"
      ? "Welcome! I'm Denis, your digital waiter."
      : input.level.denisGreeting;
  }

  if (input.level.id === 2 && lastItems.length > 0) {
    const items = lastItems.join(", ");
    return lang === "en"
      ? `Great to see you again! Last time you had ${items}.`
      : `${input.level.denisGreeting} Prošli put ste imali ${items}.`;
  }

  return input.level.denisGreeting;
}

export function buildLevelUpNudge(input: GuestLevelInput, language?: string): string | null {
  const progress = buildNextLevelProgress(input);
  if (!progress.nextLevel || progress.visitsRemaining <= 0) return null;

  const lang = (language ?? "sr").slice(0, 2);
  const visits = progress.visitsRemaining;
  const target = progress.nextLevel.name;

  if (lang === "en") {
    return `Just ${visits} more visit${visits === 1 ? "" : "s"} until ${target} status!`;
  }
  const visitWord = visits === 1 ? "poseta" : "posete";
  return `Još ${visits} ${visitWord} do ${target} statusa!`;
}

export function buildDenisToneGuide(level: GuestLevelDefinition): string {
  switch (level.denisTone) {
    case "formal":
      return "Tone: formal and welcoming — explain how ordering works, be patient with first-timers.";
    case "warm":
      return "Tone: warm returning guest — reference past visits when relevant, no need to re-explain basics.";
    case "vip":
      return "Tone: VIP treatment — highlight perks, secret menu, personalized suggestions.";
    case "casual":
      return "Tone: casual and familiar — knows favorites, skip formalities, highly personalized.";
    default:
      return "Tone: helpful and concise.";
  }
}
