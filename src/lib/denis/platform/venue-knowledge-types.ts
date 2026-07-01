import type { RhythmBehaviorDirectives } from "@/lib/denis/config/rhythm-prior-types";

export type VenueKnowledgeRetentionTier = "full" | "aggregated" | "trend";

export type VenueDrinkMix = {
  beer: number;
  wine: number;
  cocktail: number;
  other: number;
};

export type VenueLanguageShare = {
  code: string;
  sharePct: number;
  sessionCount: number;
};

export type VenuePeakHourProfile = {
  slotKey: string;
  dayOfWeek: number;
  hour: number;
  avgWaitMinutes: number | null;
  stress: "rush" | "busy" | "low" | "normal";
  behavior: RhythmBehaviorDirectives;
  label: string;
};

export type VenueItemPairLearning = {
  anchorProductId: string;
  anchorProductName: string;
  pairedProductId: string;
  pairedProductName: string;
  pairRatePct: number;
  sampleSessions: number;
};

export type VenueModifierLearning = {
  productId: string;
  productName: string;
  modifierLabel: string;
  requestRatePct: number;
  sampleOrders: number;
};

export type VenueTasteProfile = {
  drinkMix: VenueDrinkMix;
  topItemByDow: Record<string, string>;
  weekendDessertSharePct: number | null;
  weekdayDessertSharePct: number | null;
  weekendDessertLiftPct: number | null;
};

export type VenueKnowledgeSnapshot = {
  version: 1;
  computedAt: string;
  retentionTier: VenueKnowledgeRetentionTier;
  orderSampleCount: number;
  tasteProfile: VenueTasteProfile;
  languageDistribution: VenueLanguageShare[];
  defaultGreetingLanguage: string;
  peakHourProfiles: VenuePeakHourProfile[];
  itemPairLearnings: VenueItemPairLearning[];
  modifierLearnings: VenueModifierLearning[];
};

export type VenueKnowledgeJson = VenueKnowledgeSnapshot;
