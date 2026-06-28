import {
  ConciergeConfigSchema,
  type ConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  assignAbVariant,
  type AbExperiment,
} from "@/lib/denis/config/ab-experiment";
import {
  parseEventConfig,
  resolveEventEffects,
  resolveEventPhase,
  type EventModeVenueOpsSlice,
} from "@/lib/denis/config/event-mode-overlay";

export type EffectiveConciergeConfigResult = {
  config: ConciergeConfig;
  variant: "A" | "B" | null;
  experimentId: string | null;
};

export type AbExperimentConfigInput = Pick<
  AbExperiment,
  "id" | "status" | "variantA" | "variantB" | "trafficSplit"
>;

/** Apply active event profile overlay onto ConciergeConfig (N3). */
export function applyEventModeConfigOverlay(
  baseConfig: ConciergeConfig,
  venueOps: EventModeVenueOpsSlice | null | undefined
): ConciergeConfig {
  const event = parseEventConfig(venueOps?.eventConfig);
  if (venueOps?.operatingMode !== "event" || !event) {
    return baseConfig;
  }

  const phase = resolveEventPhase(event);
  const effects = resolveEventEffects(event, phase);
  const patch: PartialConciergeConfig = {};

  if (effects.skipUpsell) {
    patch.upsell = {
      foodAfterDrinks: false,
      dessertAfterDelivered: false,
      maxUpsellsPerSession: 0,
    };
  }

  if (effects.shortenReplies) {
    patch.persona = {
      maxWordsPerReply: Math.min(baseConfig.persona.maxWordsPerReply, 25),
    };
  }

  if (effects.suppressProactiveNudges) {
    patch.proactive = {
      pairing: effects.drinkPromptOnly ? baseConfig.proactive.pairing : false,
      dessert: false,
      popularityPairing: false,
      browseFollowUp: false,
      billPrompt: effects.drinkPromptOnly
        ? baseConfig.proactive.billPrompt
        : false,
      guestWelcome: effects.drinkPromptOnly
        ? baseConfig.proactive.guestWelcome
        : false,
    };
  }

  const merged = mergePartialConciergeConfig(
    baseConfig as PartialConciergeConfig,
    patch
  );

  return ConciergeConfigSchema.parse(merged);
}

/** Deep-merge a chosen variant patch onto resolved location ConciergeConfig. */
export function mergeAbVariantIntoConfig(
  baseConfig: ConciergeConfig,
  experiment: AbExperimentConfigInput,
  variant: "A" | "B"
): ConciergeConfig {
  const patch: PartialConciergeConfig =
    variant === "A" ? experiment.variantA : experiment.variantB;

  const merged = mergePartialConciergeConfig(
    baseConfig as PartialConciergeConfig,
    patch
  );

  return ConciergeConfigSchema.parse(merged);
}

/**
 * Resolve effective ConciergeConfig for a guest session — base config plus
 * active A/B variant overlay when a running experiment exists.
 */
export function resolveEffectiveConciergeConfig(
  baseConfig: ConciergeConfig,
  experiment: AbExperimentConfigInput | null,
  sessionId: string | null | undefined,
  venueOps?: EventModeVenueOpsSlice | null
): EffectiveConciergeConfigResult {
  let config = baseConfig;

  if (experiment && experiment.status === "running" && sessionId?.trim()) {
    const variant = assignAbVariant(experiment, sessionId.trim());
    config = mergeAbVariantIntoConfig(baseConfig, experiment, variant);
    config = applyEventModeConfigOverlay(config, venueOps);

    return {
      config,
      variant,
      experimentId: experiment.id,
    };
  }

  return {
    config: applyEventModeConfigOverlay(config, venueOps),
    variant: null,
    experimentId: null,
  };
}
