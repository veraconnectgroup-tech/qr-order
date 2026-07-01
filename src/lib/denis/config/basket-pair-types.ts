export type BasketPair = {
  productA: string;
  productB: string;
  productAName: string;
  productBName: string;
  coOccurrenceCount: number;
  confidencePercent: number;
  sampleSessions: number;
};

export type LearnedBasketPairsJson = {
  version: 1;
  pairs: BasketPair[];
  computedAt?: string;
};

export type HistoricalOrderRow = {
  tableSessionId: string;
  productId: string;
  productName: string;
};

export const MIN_BASKET_PAIR_SAMPLE_SESSIONS = 10;
