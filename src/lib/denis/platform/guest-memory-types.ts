export type GuestMemoryScope = "allergies" | "favorites" | "language" | "relationship";

export type PreferredMealPattern =
  | "drinks_only"
  | "main_only"
  | "starter_main_dessert"
  | "main_drinks"
  | "main_dessert"
  | "unknown";

export type GuestMemoryVisitItem = {
  productId?: string | null;
  productName: string;
  quantity?: number;
  menuSection?: string | null;
  modifiers?: string[];
};

export type GuestRelationshipVisitEvent =
  | { kind: "arrived"; at: string }
  | { kind: "ordered"; items: string[]; at: string }
  | {
      kind: "feedback";
      sentiment: "positive" | "neutral" | "negative";
      at: string;
    }
  | { kind: "party_note"; partySize: number; note?: string | null; at: string };

export type GuestRelationshipVisit = {
  visitNumber: number;
  visitedAt: string;
  daysSincePrevious: number | null;
  dayOfWeek: number;
  itemNames: string[];
  spendCents?: number | null;
  partySize?: number | null;
  feedbackSentiment?: "positive" | "neutral" | "negative" | null;
  events: GuestRelationshipVisitEvent[];
};

export type GuestPreferencePhase = {
  fromVisit: number;
  toVisit: number;
  dominantItems: string[];
};

export type GuestBehavioralPatterns = {
  typicalVisitDays: number[];
  typicalVisitDayLabels: string[];
  neverOrdersStarter: boolean;
  alwaysOrdersDessert: boolean;
  avgSpendEuros: number | null;
  preferredMealPattern: PreferredMealPattern | null;
};

export type GuestOccasionHint =
  | "celebration_larger_party"
  | "weekday_surprise"
  | "visit_milestone"
  | "date_night"
  | "family_dining"
  | "business_meal";

export type GuestRelationshipSnapshot = {
  version: 1;
  timeline: GuestRelationshipVisit[];
  behavioral: GuestBehavioralPatterns;
  preferenceEvolution: GuestPreferencePhase[];
  currentPreferenceItems: string[];
  typicalPartySize: number | null;
};

export type GuestMemoryConsent = {
  guestToken: string;
  consentedAt: string;
  scopes: GuestMemoryScope[];
};

/** Server projection for consented return-guest memory (ADR-005 §7.2). */
export type GuestMemoryProjection = {
  /** Known allergens — same as allergyLabels (journey alias). */
  allergies: string[];
  /** Top ordered item names for return welcome (max 3). */
  favoriteItems: string[];
  /** Preferred chat language (ISO-ish code). */
  language: string | null;
  /** Latin vs Cyrillic script preference for replies. */
  preferredScript?: "latin" | "cyrillic" | null;
  favoriteProductIds: string[];
  allergySheetIds: string[];
  allergyLabels: string[];
  preferredLanguage: string | null;
  visitCount: number;
  lastVisitItemNames: string[];
  /** ISO timestamp of last completed visit. */
  lastVisit: string | null;
  lastVisitAt: string | null;
  /** Average spend per visit in major currency units (EUR). */
  avgSpend: number | null;
  /** Last mood signal e.g. relaxed, happy, frustrated. */
  mood: string | null;
  preferredMealPattern?: PreferredMealPattern | null;
  modifierPreferences?: string[];
  avgSessionMinutes?: number | null;
  avgSpendCents?: number | null;
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  lastFeedbackCategory?: string | null;
  lastReviewPromptAt?: string | null;
  lastReviewDismissAt?: string | null;
  dessertNudgeDismissCount?: number;
  skipDessertNudge?: boolean;
  engagementConsentAt?: string | null;
  birthdayMonth?: number | null;
  winBackSentAt?: string | null;
  engagementMonthCount?: number;
  /** L2 relationship engine — consented guests only. */
  relationship?: GuestRelationshipSnapshot | null;
  /** Active occasion hints for this session. */
  occasions?: GuestOccasionHint[];
  /** True when guest opted in to memory personalization. */
  hasMemoryConsent?: boolean;
  consentScopes?: GuestMemoryScope[];
};

export type GuestMemorySyncPayload = {
  favoriteProductIds?: string[];
  lastVisitItemNames?: string[];
  allergyLabels?: string[];
  allergySheetIds?: string[];
  preferredLanguage?: string | null;
  preferredScript?: "latin" | "cyrillic" | null;
  preferredMealPattern?: PreferredMealPattern | null;
  modifierPreferences?: string[];
  avgSessionMinutes?: number | null;
  avgSpendCents?: number | null;
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  lastFeedbackCategory?: string | null;
  lastReviewPromptAt?: string | null;
  lastReviewDismissAt?: string | null;
  dessertNudgeDismissCount?: number;
  skipDessertNudge?: boolean;
  engagementConsentAt?: string | null;
  birthdayMonth?: number | null;
  winBackSentAt?: string | null;
  engagementMonthCount?: number;
  relationship?: GuestRelationshipSnapshot | null;
};

function moodFromFeedback(
  sentiment: GuestMemoryProjection["lastFeedbackSentiment"]
): string | null {
  if (sentiment === "positive") return "happy";
  if (sentiment === "negative") return "frustrated";
  if (sentiment === "neutral") return "neutral";
  return null;
}

function avgSpendFromCents(cents: number | null | undefined): number | null {
  if (cents == null || cents <= 0) return null;
  return Math.round(cents) / 100;
}

/** Normalize legacy + new guest memory fields for situation pack / prompts. */
export function normalizeGuestMemoryProjection(
  raw: Partial<GuestMemoryProjection>
): GuestMemoryProjection {
  const allergyLabels = raw.allergyLabels ?? raw.allergies ?? [];
  const preferredLanguage = raw.preferredLanguage ?? raw.language ?? null;
  const preferredScript = raw.preferredScript ?? null;
  const lastVisitAt = raw.lastVisitAt ?? raw.lastVisit ?? null;
  const favoriteItems =
    raw.favoriteItems?.length
      ? raw.favoriteItems.slice(0, 3)
      : (raw.lastVisitItemNames ?? []).slice(0, 3);

  return {
    favoriteProductIds: raw.favoriteProductIds ?? [],
    allergySheetIds: raw.allergySheetIds ?? [],
    allergyLabels,
    allergies: raw.allergies ?? allergyLabels,
    favoriteItems,
    preferredLanguage,
    preferredScript,
    language: raw.language ?? preferredLanguage,
    visitCount: raw.visitCount ?? 0,
    lastVisitItemNames: raw.lastVisitItemNames ?? [],
    lastVisitAt,
    lastVisit: raw.lastVisit ?? lastVisitAt,
    avgSpend:
      raw.avgSpend ??
      avgSpendFromCents(raw.avgSpendCents) ??
      null,
    mood: raw.mood ?? moodFromFeedback(raw.lastFeedbackSentiment),
    preferredMealPattern: raw.preferredMealPattern ?? null,
    modifierPreferences: raw.modifierPreferences ?? [],
    avgSessionMinutes: raw.avgSessionMinutes ?? null,
    avgSpendCents: raw.avgSpendCents ?? null,
    lastFeedbackSentiment: raw.lastFeedbackSentiment ?? null,
    lastFeedbackCategory: raw.lastFeedbackCategory ?? null,
    lastReviewPromptAt: raw.lastReviewPromptAt ?? null,
    lastReviewDismissAt: raw.lastReviewDismissAt ?? null,
    dessertNudgeDismissCount: raw.dessertNudgeDismissCount ?? 0,
    skipDessertNudge: raw.skipDessertNudge ?? false,
    engagementConsentAt: raw.engagementConsentAt ?? null,
    birthdayMonth: raw.birthdayMonth ?? null,
    winBackSentAt: raw.winBackSentAt ?? null,
    engagementMonthCount: raw.engagementMonthCount ?? 0,
    relationship: raw.relationship ?? null,
    occasions: raw.occasions ?? [],
    hasMemoryConsent: raw.hasMemoryConsent ?? false,
    consentScopes: raw.consentScopes ?? [],
  };
}

export function emptyGuestMemoryProjection(
  overrides: Partial<GuestMemoryProjection> = {}
): GuestMemoryProjection {
  return normalizeGuestMemoryProjection({
    favoriteProductIds: [],
    allergySheetIds: [],
    allergyLabels: [],
    allergies: [],
    favoriteItems: [],
    preferredLanguage: null,
    preferredScript: null,
    language: null,
    visitCount: 0,
    lastVisitItemNames: [],
    lastVisitAt: null,
    lastVisit: null,
    avgSpend: null,
    mood: null,
    preferredMealPattern: null,
    modifierPreferences: [],
    avgSessionMinutes: null,
    avgSpendCents: null,
    lastFeedbackSentiment: null,
    lastFeedbackCategory: null,
    lastReviewPromptAt: null,
    lastReviewDismissAt: null,
    dessertNudgeDismissCount: 0,
    skipDessertNudge: false,
    engagementConsentAt: null,
    birthdayMonth: null,
    winBackSentAt: null,
    engagementMonthCount: 0,
    relationship: null,
    occasions: [],
    hasMemoryConsent: false,
    consentScopes: [],
    ...overrides,
  });
}
