export {
  ConciergeConfigSchema,
  PartialConciergeConfigSchema,
  parseConciergeConfig,
  parsePartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
export type {
  ConciergeConfig,
  PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
export {
  CONCIERGE_CONFIG_CACHE_KEY_PREFIX,
  CONCIERGE_CONFIG_CACHE_TTL_SECONDS,
  CONCIERGE_PLATFORM_DEFAULTS,
  conciergeConfigCacheKey,
} from "@/lib/denis/config/concierge-defaults";
export {
  mergeConciergeConfig,
  resolveConciergeConfig,
} from "@/lib/denis/config/merge-concierge-config";
export type { ResolveConciergeConfigInput } from "@/lib/denis/config/merge-concierge-config";
export {
  getCachedConciergeConfig,
  invalidateConciergeConfigCache,
  setCachedConciergeConfig,
} from "@/lib/denis/config/config-cache";
export {
  loadConciergeConfigForLocation,
  resolveConciergeLlmRuntime,
} from "@/lib/denis/config/load-concierge-config";
export type { LoadConciergeConfigOptions } from "@/lib/denis/config/load-concierge-config";

/** Config layer marker — M1 ConciergeConfig. */
export const DENIS_CONFIG_LAYER = "config" as const;
