export type {
  VenueDrinkMix,
  VenueItemPairLearning,
  VenueKnowledgeJson,
  VenueKnowledgeRetentionTier,
  VenueKnowledgeSnapshot,
  VenueLanguageShare,
  VenueModifierLearning,
  VenuePeakHourProfile,
  VenueTasteProfile,
} from "@/lib/denis/platform/venue-knowledge-types";

export type VenueKnowledgeOrderRow = {
  tableSessionId: string;
  productId: string;
  productName: string;
  menuSection?: string | null;
  createdAt: string;
  notes?: string | null;
  modifierNames?: string[];
};

export type VenueKnowledgeAccumulateInput = {
  orderRows: VenueKnowledgeOrderRow[];
  sessionLanguages?: string[];
  rhythmSlotSessions?: Record<
    string,
    { sampleSessions: number; avgWaitMinutes?: number | null }
  >;
  now?: Date;
};
