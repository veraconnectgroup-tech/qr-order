/** Venue Knowledge Graph — node/edge types (ADR-004 §5). */

export type VkgNodeKind = "product" | "category" | "tag";

export type VkgProductNode = {
  id: string;
  kind: "product";
  name: string;
  categoryId: string | null;
  menuSection: string;
  allergens: string[];
  price: number;
  isAvailable: boolean;
  aiDescription: string | null;
};

export type VkgCategoryNode = {
  id: string;
  kind: "category";
  name: string;
  menuSection: string;
};

export type VkgNode = VkgProductNode | VkgCategoryNode;

export type VkgPairsWithEdge = {
  type: "pairs_with";
  fromKind: "product" | "category";
  fromId: string;
  toProductId: string;
  weight: number;
  reason: string;
  ruleId: string | null;
};

export type VkgEdge = VkgPairsWithEdge;

export type VenueKnowledgeGraph = {
  locationId: string;
  builtAt: string;
  products: Record<string, VkgProductNode>;
  categories: Record<string, VkgCategoryNode>;
  edges: VkgEdge[];
  /** Basket-analysis pairings merged at query time (X1). */
  learnedPairings?: import("@/lib/denis/intelligence/dynamic-vkg").LearnedPairing[];
};

export type VkgPairingSource = "admin" | "learned";

export type VkgPairingSuggestion = {
  productId: string;
  name: string;
  price: number;
  menuSection: string;
  weight: number;
  reason: string;
  ruleId: string | null;
  source?: VkgPairingSource;
  /** Learned pairing stats for staff copilot / debugging. */
  stats?: {
    confidence: number;
    lift: number;
    support: number;
    coOrderCount: number;
  };
};

export type VkgProductExplain = {
  productId: string;
  name: string;
  price: number;
  menuSection: string;
  allergens: string[];
  aiDescription: string | null;
  pairings: VkgPairingSuggestion[];
};

export type VkgSubstituteSuggestion = {
  productId: string;
  name: string;
  price: number;
  menuSection: string;
  reason: string;
};

export type VkgUnavailableSubstitute = {
  sourceProductId: string;
  sourceName: string;
  substitutes: VkgSubstituteSuggestion[];
};
