export {
  ConciergeConfigSchema,
  PartialConciergeConfigSchema,
  parseConciergeConfig,
  parsePartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
export type {
  ConciergeConfig,
  PartialConciergeConfig,
  ConciergePersona,
  ConciergeLanguage,
  ConciergeContext,
  ConciergeOrdering,
  ConciergeUpsell,
  ConciergeProactive,
  ConciergeTone,
  ConciergeGreetingStyle,
} from "@/lib/denis/config/concierge-config.schema";
export {
  CONCIERGE_CONFIG_CACHE_KEY_PREFIX,
  CONCIERGE_CONFIG_CACHE_TTL_SECONDS,
  CONCIERGE_PLATFORM_DEFAULTS,
  conciergeConfigCacheKey,
} from "@/lib/denis/config/concierge-defaults";
export {
  mergeConciergeConfig,
  mergePartialConciergeConfig,
  resolveConciergeConfig,
} from "@/lib/denis/config/merge-concierge-config";
export {
  DENIS_ROLLOUT_PRESETS,
  denisRolloutFormFromEffective,
  denisRolloutFormFromPreset,
  denisRolloutPatchFromForm,
} from "@/lib/denis/config/rollout-cutover";
export type {
  DenisRolloutFormState,
  DenisRolloutPresetId,
} from "@/lib/denis/config/rollout-cutover";
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
export {
  AB_EXPERIMENT_CONSTANTS,
  assignAbVariant,
  evaluateAbExperiment,
  hashSessionExperimentBucket,
} from "@/lib/denis/config/ab-experiment";
export type {
  AbExperiment,
  AbExperimentMetric,
  AbExperimentResult,
  AbSessionMetrics,
} from "@/lib/denis/config/ab-experiment";
export {
  mergeAbVariantIntoConfig,
  applyEventModeConfigOverlay,
  resolveEffectiveConciergeConfig,
} from "@/lib/denis/config/resolve-effective-config";
export type { EffectiveConciergeConfigResult } from "@/lib/denis/config/resolve-effective-config";
export {
  canaryCohortBucket,
  guestSeesLegacyPath,
  isInCanaryCohort,
  kernelTimelineEnabled,
  parseRolloutModeFromEnv,
  resolveEffectiveRollout,
  resolveGuestLegacyPath,
  resolveTableSessionActorEnabled,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
export type { GuestLegacyPathOptions } from "@/lib/denis/config/rollout";
export type { ConciergeRollout, ConciergeRolloutMode } from "@/lib/denis/config/rollout";
export {
  buildConciergeConfigPreview,
} from "@/lib/denis/config/concierge-config-preview";
export type {
  ConciergeConfigPreview,
  ConciergePreviewLine,
} from "@/lib/denis/config/concierge-config-preview";
export {
  exportConciergeConfig,
  exportPlatformDefaultsJson,
  importConciergeConfig,
} from "@/lib/denis/config/concierge-config-io";
export type { ConciergeConfigExport } from "@/lib/denis/config/concierge-config-io";
