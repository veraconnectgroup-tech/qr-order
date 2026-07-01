import { AI_CONFIG } from "@/lib/ai/config";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  mergeManifestConfig,
  type EffectiveRuntimeConfig,
} from "@/lib/denis/cognition/manifest/merge-manifest-config";
import type {
  VenueManifestCapabilities,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import {
  isMenuRagEnabled,
} from "@/lib/denis/cognition/context/retrievers/menu-rag";
import {
  DENIS_TIER_DEFAULTS,
} from "@/lib/denis/cognition/tier-defaults";
import type {
  DenisPerceiveMode,
  DenisRuntimeResolvedProfile,
  DenisServiceTier,
} from "@/lib/denis/cognition/runtime-profile-types";
import {
  routeTurnModel,
  type ModelEscalationRegistry,
  type ModelRouteDecision,
} from "@/lib/denis/cognition/tde/model-router";
import type { BeliefGraph, TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";

function envDefaultModel(): string {
  return AI_CONFIG.model;
}

function resolveModel(
  override: string | null | undefined,
  tierDefault: string,
  llmFallback: string | null | undefined
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  const llm = llmFallback?.trim();
  if (llm) return llm;
  return tierDefault || envDefaultModel();
}

/** Map capability lattice → service tier (ADR-023 §8). */
export function inferTierFromCapabilities(
  capabilities: VenueManifestCapabilities
): DenisServiceTier {
  if (capabilities.relational >= 4 && capabilities.transactional >= 4) {
    return "enterprise";
  }
  if (capabilities.relational >= 3 && capabilities.catalogRag >= 2) {
    return "elite";
  }
  if (capabilities.transactional >= 2 || capabilities.relational >= 2) {
    return "premium";
  }
  return "standard";
}

export type ResolveRuntimeProfileResult = {
  profile: DenisRuntimeResolvedProfile;
  effective: EffectiveRuntimeConfig;
};

/**
 * Resolve tier + models from ConciergeConfig + optional venue manifest (MR-3).
 * Replaces legacy `src/lib/denis/elite/`.
 */
export function resolveRuntimeProfile(
  config: ConciergeConfig,
  manifestRaw?: unknown,
  orgManifestRaw?: unknown
): ResolveRuntimeProfileResult {
  const effective = mergeManifestConfig(config, manifestRaw, {
    orgCeilingRaw: orgManifestRaw,
  });

  const tier = effective.manifest
    ? inferTierFromCapabilities(effective.capabilities)
    : "standard";
  const tierDefaults = DENIS_TIER_DEFAULTS[tier];

  const menuRagEnabled =
    tierDefaults.menuRagEnabled &&
    isMenuRagEnabled({
      catalogRagLevel: effective.capabilities.catalogRag,
    });

  const models = {
    social: resolveModel(
      effective.models.relational,
      tierDefaults.models.social,
      effective.config.llm.model
    ),
    commerce: resolveModel(
      effective.models.transactional,
      tierDefaults.models.commerce,
      effective.config.llm.model
    ),
    narrate: resolveModel(
      effective.models.narrate,
      tierDefaults.models.narrate,
      effective.config.llm.fallbackModel ?? effective.config.llm.model
    ),
  };

  const profile: DenisRuntimeResolvedProfile = {
    tier,
    perceivePipeline: tierDefaults.perceivePipeline,
    menuRagEnabled,
    models,
    maxContextTokens: Math.max(
      effective.config.context.maxContextTokens,
      tierDefaults.maxContextTokens
    ),
    adaptiveContext: effective.config.context.adaptiveContext,
    minContextTokens: effective.config.context.minContextTokens,
  };

  return { profile, effective };
}

/** Model for perceive given TDE plan branch. */
export function resolvePerceiveModel(
  profile: DenisRuntimeResolvedProfile,
  mode: DenisPerceiveMode
): string {
  if (profile.perceivePipeline === "unified") {
    return profile.models.commerce;
  }
  return mode === "social" ? profile.models.social : profile.models.commerce;
}

export type ResolveAdaptiveModelRouteInput = {
  message: string;
  turnPlan: TurnPlan;
  profile: DenisRuntimeResolvedProfile;
  perceiveMode: DenisPerceiveMode;
  beliefs?: BeliefGraph;
  escalation?: ModelEscalationRegistry;
};

/** Per-turn adaptive model selection (2→2). */
export function resolveAdaptiveModelRoute(
  input: ResolveAdaptiveModelRouteInput
): ModelRouteDecision {
  return routeTurnModel(input);
}

/** @deprecated Use resolveAdaptiveModelRoute — static profile fallback only. */
export function resolvePerceiveModelLegacy(
  profile: DenisRuntimeResolvedProfile,
  mode: DenisPerceiveMode
): string {
  return resolvePerceiveModel(profile, mode);
}

/** @deprecated Use resolveRuntimeProfile */
export const resolveEliteProfile = (
  config: ConciergeConfig,
  manifestRaw?: unknown,
  orgManifestRaw?: unknown
): DenisRuntimeResolvedProfile =>
  resolveRuntimeProfile(config, manifestRaw, orgManifestRaw).profile;
