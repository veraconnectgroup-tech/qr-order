export type {
  VenueKnowledgeGraph,
  VkgEdge,
  VkgNode,
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgProductNode,
  VkgSubstituteSuggestion,
} from "@/lib/denis/kernel/vkg/types";
export {
  buildVenueKnowledgeGraph,
  type CatalogCategorySnapshot,
  type CatalogProductSnapshot,
  type UpsellRuleSnapshot,
} from "@/lib/denis/kernel/vkg/build-graph";
export {
  explainProduct,
  pairingFor,
  pairingForSafe,
  safeForAllergies,
  substituteFor,
} from "@/lib/denis/kernel/vkg/queries";
export {
  loadVenueKnowledgeGraph,
  invalidateVenueKnowledgeGraphCache,
  vkgCacheKey,
  VKG_CACHE_KEY_PREFIX,
  VKG_CACHE_TTL_SECONDS,
} from "@/lib/denis/kernel/vkg/load-graph";
