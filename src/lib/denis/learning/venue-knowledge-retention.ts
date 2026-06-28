import type {
  VenueKnowledgeRetentionTier,
  VenueKnowledgeSnapshot,
} from "@/lib/denis/platform/venue-knowledge-types";
import type { VenueKnowledgeOrderRow } from "@/lib/denis/learning/venue-knowledge-types";

export const VENUE_KNOWLEDGE_FULL_DETAIL_DAYS = 90;
export const VENUE_KNOWLEDGE_AGGREGATED_DAYS = 180;

const MS_DAY = 86_400_000;

export function ageDaysFromIso(iso: string, now: Date): number {
  const created = Date.parse(iso);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / MS_DAY));
}

export function classifyRetentionTier(
  oldestOrderAgeDays: number
): VenueKnowledgeRetentionTier {
  if (oldestOrderAgeDays <= VENUE_KNOWLEDGE_FULL_DETAIL_DAYS) return "full";
  if (oldestOrderAgeDays <= VENUE_KNOWLEDGE_AGGREGATED_DAYS) return "aggregated";
  return "trend";
}

export function partitionOrderRowsByRetention(
  rows: VenueKnowledgeOrderRow[],
  now: Date
): {
  full: VenueKnowledgeOrderRow[];
  aggregated: VenueKnowledgeOrderRow[];
  trend: VenueKnowledgeOrderRow[];
  oldestAgeDays: number;
} {
  const full: VenueKnowledgeOrderRow[] = [];
  const aggregated: VenueKnowledgeOrderRow[] = [];
  const trend: VenueKnowledgeOrderRow[] = [];
  let oldestAgeDays = 0;

  for (const row of rows) {
    const age = ageDaysFromIso(row.createdAt, now);
    oldestAgeDays = Math.max(oldestAgeDays, age);
    if (age <= VENUE_KNOWLEDGE_FULL_DETAIL_DAYS) {
      full.push(row);
    } else if (age <= VENUE_KNOWLEDGE_AGGREGATED_DAYS) {
      aggregated.push(row);
    } else {
      trend.push(row);
    }
  }

  return { full, aggregated, trend, oldestAgeDays };
}

/** Strip personal detail for GDPR-safe venue artifact (aggregate stats only). */
export function applyRetentionPolicyToSnapshot(
  snapshot: VenueKnowledgeSnapshot,
  tier: VenueKnowledgeRetentionTier
): VenueKnowledgeSnapshot {
  if (tier === "full") return snapshot;

  const next: VenueKnowledgeSnapshot = {
    ...snapshot,
    retentionTier: tier,
  };

  if (tier === "aggregated") {
    next.itemPairLearnings = snapshot.itemPairLearnings.slice(0, 12);
    next.modifierLearnings = snapshot.modifierLearnings.slice(0, 8);
    next.peakHourProfiles = snapshot.peakHourProfiles.slice(0, 8);
    return next;
  }

  // trend — keep percentages and top-level trends only
  next.itemPairLearnings = snapshot.itemPairLearnings
    .slice(0, 5)
    .map((row) => ({
      ...row,
      sampleSessions: 0,
    }));
  next.modifierLearnings = snapshot.modifierLearnings
    .slice(0, 3)
    .map((row) => ({
      ...row,
      sampleOrders: 0,
    }));
  next.peakHourProfiles = snapshot.peakHourProfiles.slice(0, 4);
  next.languageDistribution = snapshot.languageDistribution.map((row) => ({
    ...row,
    sessionCount: 0,
  }));
  return next;
}
