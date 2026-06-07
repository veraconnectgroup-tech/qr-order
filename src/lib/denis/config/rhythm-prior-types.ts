export type VenueServicePeriod =
  | "breakfast"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "late";

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
};

export type ResolvedRhythmContext = {
  mode: "off" | "shadow" | "enforce";
  active: boolean;
  applied: boolean;
  slotKey: string | null;
  confidence: number;
  defaultDessertDelayMinutes: number;
  wouldOverrideDessertDelayMinutes: number | null;
  topProducts: RhythmSlotTopProduct[];
  servicePeriod: VenueServicePeriod | null;
};
