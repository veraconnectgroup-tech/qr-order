import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import type { VenueKnowledgeJson } from "@/lib/denis/platform/venue-knowledge-types";

export type LocationRhythmPriorsWithKnowledge = LocationRhythmPriorsJson & {
  venueKnowledge?: VenueKnowledgeJson;
};

export function parseVenueKnowledgeFromPriors(
  raw: unknown
): VenueKnowledgeJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = (raw as { venueKnowledge?: unknown }).venueKnowledge;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const snapshot = candidate as VenueKnowledgeJson;
  if (snapshot.version !== 1 || !snapshot.computedAt) return null;
  return snapshot;
}

export function attachVenueKnowledgeToPriors(
  priors: LocationRhythmPriorsJson,
  venueKnowledge: VenueKnowledgeJson
): LocationRhythmPriorsWithKnowledge {
  return {
    ...priors,
    venueKnowledge,
  };
}
