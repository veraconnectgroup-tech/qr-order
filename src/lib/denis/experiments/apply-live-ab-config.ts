import {
  ConciergeConfigSchema,
  type ConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  assignSessionVariant,
  type Experiment,
} from "@/lib/denis/experiments/live-ab";

export type LiveAbConfigResult = {
  config: ConciergeConfig;
  variant: "A" | "B" | null;
  experimentId: string | null;
};

/** Merge active experiment variant onto resolved location config. */
export function applyLiveAbConfig(
  baseConfig: ConciergeConfig,
  experiment: Experiment | null,
  sessionToken: string | null | undefined
): LiveAbConfigResult {
  if (!experiment || experiment.status !== "running" || !sessionToken?.trim()) {
    return { config: baseConfig, variant: null, experimentId: null };
  }

  const variant = assignSessionVariant(experiment, sessionToken.trim());
  const patch: PartialConciergeConfig =
    variant === "A" ? experiment.variantA : experiment.variantB;

  const merged = mergePartialConciergeConfig(
    baseConfig as unknown as PartialConciergeConfig,
    patch
  );

  return {
    config: ConciergeConfigSchema.parse(merged),
    variant,
    experimentId: experiment.id,
  };
}
