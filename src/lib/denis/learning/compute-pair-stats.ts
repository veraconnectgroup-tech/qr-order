import type {
  AggregatedPairStat,
  SessionPairInput,
} from "@/lib/denis/learning/types";

function pairKey(fromProductId: string, toProductId: string): string {
  return `${fromProductId}:${toProductId}`;
}

/** Aggregate recommended→added pairing stats from guest sessions (M16). */
export function aggregateSessionPairStats(
  sessions: SessionPairInput[]
): AggregatedPairStat[] {
  const stats = new Map<string, AggregatedPairStat>();

  for (const session of sessions) {
    const added = new Set(session.productsAdded);
    const anchorId =
      session.productsAdded.length > 0
        ? session.productsAdded[session.productsAdded.length - 1]
        : null;

    if (!anchorId) continue;

    const seenRec = new Set<string>();
    for (const recommendedId of session.productsRecommended) {
      if (recommendedId === anchorId || seenRec.has(recommendedId)) continue;
      seenRec.add(recommendedId);

      const key = pairKey(anchorId, recommendedId);
      const prev = stats.get(key) ?? {
        fromProductId: anchorId,
        toProductId: recommendedId,
        impressions: 0,
        accepts: 0,
      };

      prev.impressions += 1;
      if (added.has(recommendedId)) prev.accepts += 1;
      stats.set(key, prev);
    }
  }

  return [...stats.values()];
}

export function acceptRate(impressions: number, accepts: number): number {
  if (impressions <= 0) return 0;
  return Math.min(1, accepts / impressions);
}

export function suggestedWeightFromAcceptRate(rate: number): number {
  return Math.min(1, Math.max(0.1, Number(rate.toFixed(4))));
}

export function meetsLearnedEdgeThreshold(input: {
  impressions: number;
  acceptRate: number;
  minImpressions: number;
  minAcceptRate: number;
}): boolean {
  return (
    input.impressions >= input.minImpressions &&
    input.acceptRate >= input.minAcceptRate
  );
}
