export type {
  VenueKnowledgeGraph,
  VkgEdge,
  VkgNode,
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgProductNode,
  VkgSubstituteSuggestion,
  VkgUnavailableSubstitute,
} from "@/lib/denis/kernel/vkg/types";
export {
  buildVenueKnowledgeGraph,
  type CatalogCategorySnapshot,
  type CatalogProductSnapshot,
  type UpsellRuleSnapshot,
} from "@/lib/denis/kernel/vkg/build-graph";
export {
  allergySafeMenuProductIds,
  explainPopularProducts,
  explainProduct,
  matchProductsInMessage,
  pairingFor,
  pairingForSafe,
  safeForAllergies,
  substituteFor,
  substitutesForUnavailable,
} from "@/lib/denis/kernel/vkg/queries";
export {
  classifyDrinkKnowledge,
  foodTagsFromProductName,
  mocktailFor,
  formatDrinkNodeLine,
  type DrinkCategory,
  type DrinkKnowledgeNode,
  type DrinkOccasion,
} from "@/lib/denis/kernel/vkg/drink-knowledge-graph";
export {
  loadVenueKnowledgeGraph,
  invalidateVenueKnowledgeGraphCache,
  vkgCacheKey,
  VKG_CACHE_KEY_PREFIX,
  VKG_CACHE_TTL_SECONDS,
} from "@/lib/denis/kernel/vkg/load-graph";
