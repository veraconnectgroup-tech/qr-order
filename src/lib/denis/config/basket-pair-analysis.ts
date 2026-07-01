import type {
  BasketPair,
  HistoricalOrderRow,
  LearnedBasketPairsJson,
} from "@/lib/denis/config/basket-pair-types";
import { MIN_BASKET_PAIR_SAMPLE_SESSIONS } from "@/lib/denis/config/basket-pair-types";

type SessionBucket = {
  productIds: Set<string>;
  names: Map<string, string>;
};

function buildSessionBuckets(rows: HistoricalOrderRow[]): Map<string, SessionBucket> {
  const sessions = new Map<string, SessionBucket>();

  for (const row of rows) {
    const sessionId = row.tableSessionId.trim();
    const productId = row.productId.trim();
    if (!sessionId || !productId) continue;

    let bucket = sessions.get(sessionId);
    if (!bucket) {
      bucket = { productIds: new Set(), names: new Map() };
      sessions.set(sessionId, bucket);
    }

    bucket.productIds.add(productId);
    const name = row.productName.trim();
    if (name) bucket.names.set(productId, name);
  }

  return sessions;
}

/** Compute directed basket pairs from historical delivered orders (G1). */
export function computeBasketPairs(
  orders: HistoricalOrderRow[],
  options?: { minSampleSessions?: number }
): BasketPair[] {
  const minSampleSessions =
    options?.minSampleSessions ?? MIN_BASKET_PAIR_SAMPLE_SESSIONS;
  const sessions = buildSessionBuckets(orders);
  if (sessions.size === 0) return [];

  const anchorSessionCount = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const nameByProduct = new Map<string, string>();

  for (const session of sessions.values()) {
    for (const [productId, name] of session.names) {
      if (name) nameByProduct.set(productId, name);
    }

    const ids = [...session.productIds];
    for (const id of ids) {
      anchorSessionCount.set(id, (anchorSessionCount.get(id) ?? 0) + 1);
    }

    for (const productA of ids) {
      for (const productB of ids) {
        if (productA === productB) continue;
        const key = `${productA}|${productB}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: BasketPair[] = [];

  for (const [key, coOccurrenceCount] of pairCount) {
    const [productA, productB] = key.split("|");
    if (!productA || !productB) continue;

    const sampleSessions = anchorSessionCount.get(productA) ?? 0;
    if (sampleSessions < minSampleSessions) continue;

    const confidencePercent = Math.round(
      (coOccurrenceCount / sampleSessions) * 100
    );
    if (confidencePercent <= 0) continue;

    pairs.push({
      productA,
      productB,
      productAName: nameByProduct.get(productA) ?? productA,
      productBName: nameByProduct.get(productB) ?? productB,
      coOccurrenceCount,
      confidencePercent,
      sampleSessions,
    });
  }

  return pairs.sort((a, b) => {
    if (b.confidencePercent !== a.confidencePercent) {
      return b.confidencePercent - a.confidencePercent;
    }
    return b.coOccurrenceCount - a.coOccurrenceCount;
  });
}

export function emptyLearnedBasketPairs(): LearnedBasketPairsJson {
  return { version: 1, pairs: [] };
}

export function parseLearnedBasketPairs(value: unknown): LearnedBasketPairsJson | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.pairs)) return null;

  const pairs = record.pairs
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const pair = row as Record<string, unknown>;
      const productA =
        typeof pair.productA === "string" ? pair.productA.trim() : "";
      const productB =
        typeof pair.productB === "string" ? pair.productB.trim() : "";
      if (!productA || !productB) return null;

      const coOccurrenceCount = Number(pair.coOccurrenceCount);
      const confidencePercent = Number(pair.confidencePercent);
      const sampleSessions = Number(pair.sampleSessions);
      if (
        !Number.isFinite(coOccurrenceCount) ||
        !Number.isFinite(confidencePercent) ||
        !Number.isFinite(sampleSessions)
      ) {
        return null;
      }

      return {
        productA,
        productB,
        productAName:
          typeof pair.productAName === "string"
            ? pair.productAName.trim()
            : productA,
        productBName:
          typeof pair.productBName === "string"
            ? pair.productBName.trim()
            : productB,
        coOccurrenceCount,
        confidencePercent,
        sampleSessions,
      } satisfies BasketPair;
    })
    .filter((row): row is BasketPair => row != null);

  return {
    version: 1,
    pairs,
    computedAt:
      typeof record.computedAt === "string" ? record.computedAt : undefined,
  };
}

export function pickLearnedPairForCart(
  pairs: BasketPair[],
  cartProductIds: string[],
  minSampleSessions = MIN_BASKET_PAIR_SAMPLE_SESSIONS
): BasketPair | null {
  const cartSet = new Set(cartProductIds.filter(Boolean));
  if (cartSet.size === 0) return null;

  return (
    pairs.find(
      (pair) =>
        cartSet.has(pair.productA) &&
        !cartSet.has(pair.productB) &&
        pair.sampleSessions >= minSampleSessions
    ) ?? null
  );
}

export function pickTopLearnedPopularityPair(
  pairs: BasketPair[],
  minSampleSessions = MIN_BASKET_PAIR_SAMPLE_SESSIONS
): { from: string; to: string; pair: BasketPair } | null {
  const top = pairs.find((pair) => pair.sampleSessions >= minSampleSessions);
  if (!top) return null;
  return {
    from: top.productAName,
    to: top.productBName,
    pair: top,
  };
}
