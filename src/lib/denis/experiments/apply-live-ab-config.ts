import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { Experiment } from "@/lib/denis/experiments/live-ab";
import {
  resolveEffectiveConciergeConfig,
  type EffectiveConciergeConfigResult,
} from "@/lib/denis/config/resolve-effective-config";

export type LiveAbConfigResult = EffectiveConciergeConfigResult;

/** Merge active experiment variant onto resolved location config. */
export function applyLiveAbConfig(
  baseConfig: ConciergeConfig,
  experiment: Experiment | null,
  sessionToken: string | null | undefined
): LiveAbConfigResult {
  return resolveEffectiveConciergeConfig(baseConfig, experiment, sessionToken);
}
