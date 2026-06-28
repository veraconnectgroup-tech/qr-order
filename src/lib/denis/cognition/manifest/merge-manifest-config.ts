import {
  ConciergeConfigSchema,
  type ConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import {
  resolveCustomPlaybookPack,
  resolvePlaybookPackId,
} from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import {
  parseVenueManifest,
  VENUE_MANIFEST_OPEN_CAPABILITIES,
  type CustomPlaybookPack,
  type VenueManifest,
  type VenueManifestCapabilities,
  type VenueQualityContract,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";

export type EffectiveRuntimeModels = {
  transactional: string | null;
  relational: string | null;
  narrate: string | null;
};

/** Manifest + ConciergeConfig merged for runtime (MR-4). */
export type EffectiveRuntimeConfig = {
  config: ConciergeConfig;
  manifest: VenueManifest | null;
  orgManifest: VenueManifest | null;
  capabilities: VenueManifestCapabilities;
  models: EffectiveRuntimeModels;
  qualityContract: VenueQualityContract | null;
  playbookPackId: string | null;
  customPlaybookPack: CustomPlaybookPack | null;
};

export type MergeManifestConfigOptions = {
  /** Org contract ceiling — location capabilities cannot exceed. */
  orgCeilingRaw?: unknown;
};

/** Min each capability lattice against optional org ceiling. */
export function clampManifestCapabilities(
  location: VenueManifestCapabilities,
  orgCeiling: VenueManifestCapabilities | null | undefined
): VenueManifestCapabilities {
  if (!orgCeiling) {
    return { ...location };
  }

  return {
    relational: Math.min(location.relational, orgCeiling.relational),
    transactional: Math.min(location.transactional, orgCeiling.transactional),
    catalogRag: Math.min(location.catalogRag, orgCeiling.catalogRag),
    guestMemory: Math.min(location.guestMemory, orgCeiling.guestMemory),
    anticipation: Math.min(location.anticipation, orgCeiling.anticipation),
  };
}

function applyManifestFields(
  config: ConciergeConfig,
  manifest: VenueManifest
): ConciergeConfig {
  let next = config;

  if (manifest.identity?.persona) {
    next = {
      ...next,
      persona: { ...next.persona, tone: manifest.identity.persona },
    };
  }

  if (manifest.identity?.defaultLanguage) {
    const locale = manifest.identity.defaultLanguage.trim().slice(0, 2);
    next = {
      ...next,
      language: { ...next.language, venueDefault: locale },
    };
  }

  if (manifest.policy?.requireExplicitConfirm !== undefined) {
    next = {
      ...next,
      ordering: {
        ...next.ordering,
        requireExplicitConfirm: manifest.policy.requireExplicitConfirm,
      },
    };
  }

  if (manifest.policy?.rushSkipUpsell !== undefined) {
    next = {
      ...next,
      ops: { ...next.ops, rushSkipUpsell: manifest.policy.rushSkipUpsell },
    };
  }

  if (manifest.policy?.maxUpsellsPerSession !== undefined) {
    next = {
      ...next,
      upsell: {
        ...next.upsell,
        maxUpsellsPerSession: manifest.policy.maxUpsellsPerSession,
      },
    };
  }

  if (manifest.models?.transactional) {
    next = {
      ...next,
      llm: { ...next.llm, model: manifest.models.transactional },
    };
  }

  if (manifest.models?.narrate) {
    next = {
      ...next,
      llm: { ...next.llm, fallbackModel: manifest.models.narrate },
    };
  }

  return next;
}

/** Disable features when capability lattice is below ADR-023 §7 thresholds. */
export function applyCapabilityClamps(
  config: ConciergeConfig,
  capabilities: VenueManifestCapabilities
): ConciergeConfig {
  let next = config;

  if (capabilities.guestMemory < 2) {
    next = {
      ...next,
      memory: { ...next.memory, returnGuestEnabled: false },
    };
  }

  if (capabilities.anticipation < 1) {
    next = {
      ...next,
      proactive: { ...next.proactive, enabled: false },
    };
  } else if (capabilities.anticipation < 2) {
    next = {
      ...next,
      proactive: {
        ...next.proactive,
        dessert: false,
        pairing: false,
        slowKitchen: false,
        reviewPrompt: false,
      },
    };
  }

  if (capabilities.transactional < 2) {
    next = {
      ...next,
      llm: { ...next.llm, slotExtractWithLlm: false },
      ordering: { ...next.ordering, slotExtractEnabled: false },
    };
  }

  if (capabilities.relational < 2) {
    next = {
      ...next,
      llm: { ...next.llm, narrateWithLlm: false },
    };
  }

  return next;
}

function resolveEffectiveModels(
  config: ConciergeConfig,
  manifest: VenueManifest | null
): EffectiveRuntimeModels {
  return {
    transactional:
      manifest?.models?.transactional?.trim() ?? config.llm.model?.trim() ?? null,
    relational:
      manifest?.models?.relational?.trim() ?? config.llm.model?.trim() ?? null,
    narrate:
      manifest?.models?.narrate?.trim() ??
      config.llm.fallbackModel?.trim() ??
      config.llm.model?.trim() ??
      null,
  };
}

/**
 * Merge venue manifest with ConciergeConfig.
 * Invalid or missing manifest → unchanged config, open capabilities (no clamp).
 */
export function mergeManifestConfig(
  config: ConciergeConfig,
  manifestRaw?: unknown,
  options: MergeManifestConfigOptions = {}
): EffectiveRuntimeConfig {
  const manifest = parseVenueManifest(manifestRaw);
  const orgManifest = parseVenueManifest(options.orgCeilingRaw);

  const locationCapabilities =
    manifest?.capabilities ?? VENUE_MANIFEST_OPEN_CAPABILITIES;
  const capabilities = clampManifestCapabilities(
    locationCapabilities,
    orgManifest?.capabilities
  );

  let mergedConfig = config;
  if (manifest) {
    mergedConfig = applyManifestFields(mergedConfig, manifest);
  }
  mergedConfig = applyCapabilityClamps(mergedConfig, capabilities);
  mergedConfig = ConciergeConfigSchema.parse(mergedConfig);

  return {
    config: mergedConfig,
    manifest,
    orgManifest,
    capabilities,
    models: resolveEffectiveModels(mergedConfig, manifest),
    qualityContract: manifest?.qualityContract ?? null,
    playbookPackId: resolvePlaybookPackId(orgManifest, manifest),
    customPlaybookPack: resolveCustomPlaybookPack(orgManifest, manifest),
  };
}
