export type LearnedEdgeType = "pairs_with" | "upsell_after";

export type LearnedEdgeStatus = "pending" | "approved" | "rejected";

export type LearnedEdgeCandidate = {
  edgeType: LearnedEdgeType;
  fromProductId: string;
  toProductId: string;
  impressions: number;
  accepts: number;
  acceptRate: number;
  suggestedWeight: number;
  status: LearnedEdgeStatus;
};

export type SessionPairInput = {
  productsRecommended: string[];
  productsAdded: string[];
};

export type AggregatedPairStat = {
  fromProductId: string;
  toProductId: string;
  impressions: number;
  accepts: number;
};
