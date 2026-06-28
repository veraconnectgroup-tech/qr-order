export {
  buildPersonalityBlock,
  buildPersonaIdentityBlock,
  buildEmotionalIntelligenceBlock,
  buildGuestLevelAdaptationBlock,
  buildSessionMemoryBlock,
  buildManifestPersonalityOverlay,
  resolveDayPeriod,
  type DayPeriod,
  type PersonalityEngineInput,
} from "@/lib/denis/cognition/personality/personality-engine";

export {
  buildHumorGuidanceBlock,
  isHumorAllowed,
  isHumorSafe,
  GLOBAL_HUMOR_FORBIDDEN,
} from "@/lib/denis/cognition/personality/humor-engine";

export {
  buildCulturalSensitivityBlock,
  resolveCulturalProfile,
  type CulturalProfile,
} from "@/lib/denis/cognition/personality/cultural-sensitivity";
