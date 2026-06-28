import type { LocationPrepTimePriorsJson } from "@/lib/denis/config/prep-time-priors";

export type VenueServicePeriod =
  | "breakfast"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "late";

export type RhythmSlotStress = "low" | "normal" | "busy" | "high" | "rush";

export type RhythmTopProductSummary = {
  productId?: string | null;
  name: string;
  sharePct?: number | null;
  count?: number;
};

export type RhythmSlotTopProduct = {
  productId: string | null;
  name: string;
  count: number;
};

export type RhythmSlotPrior = {
  sampleSessions: number;
  sessionDurationP50Min: number | null;
  dessertDelayP50Min: number | null;
  revenueEma: number | null;
  topProducts: RhythmSlotTopProduct[];
  servicePeriod: VenueServicePeriod;
};

export type LocationRhythmPriorsJson = {
  version: 1;
  slots: Record<string, RhythmSlotPrior>;
  prepTime?: LocationPrepTimePriorsJson;
};

export type RhythmBehaviorDirectives = {
  shortenReplies: boolean;
  skipUpsell: boolean;
  /** full | reduced | none */
  upsellLevel: "full" | "reduced" | "none";
  conversationalTone: "warm_chatty" | "balanced" | "concise";
};

export type ResolvedRhythmContext = {
  mode: "off" | "shadow" | "enforce";
  active: boolean;
  applied: boolean;
  slotKey: string | null;
  slotLabel?: string | null;
  slotSampleSessions?: number | null;
  confidence: number;
  defaultDessertDelayMinutes: number;
  wouldOverrideDessertDelayMinutes: number | null;
  topProducts: RhythmSlotTopProduct[];
  servicePeriod: VenueServicePeriod | null;
  currentSlotStress?: RhythmSlotStress | null;
  typicalSessionMinutes?: number | null;
  kitchenPrepAvgMinutes?: number | null;
  kitchenPrepRushMinutes?: number | null;
  topProductSummaries: RhythmTopProductSummary[];
  behaviorDirectives?: RhythmBehaviorDirectives | null;
  /** Ops hint for managers — e.g. "Petak 19-22 prosečno 35 narudžbina — treba 3 konobara". */
  staffSuggestion?: string | null;
  /** Guest-facing service-period opener for system prompt / welcome. */
  servicePeriodGreeting?: string | null;
};
