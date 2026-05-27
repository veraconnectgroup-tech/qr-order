import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import type { VenueSimExperimentOverrides } from "@/lib/denis/eval/venue-sim-types";

/** Build counterfactual ConciergeConfig — deterministic, no guest impact (M20). */
export function applyVenueSimOverrides(
  base: ConciergeConfig,
  overrides: VenueSimExperimentOverrides
): ConciergeConfig {
  return mergeConciergeConfig(base, null, {
    ordering: overrides.orderingFlow
      ? { flow: overrides.orderingFlow }
      : undefined,
    upsell:
      overrides.foodAfterDrinks !== undefined ||
      overrides.maxUpsellsPerSession !== undefined
        ? {
            ...(overrides.foodAfterDrinks !== undefined
              ? { foodAfterDrinks: overrides.foodAfterDrinks }
              : {}),
            ...(overrides.maxUpsellsPerSession !== undefined
              ? { maxUpsellsPerSession: overrides.maxUpsellsPerSession }
              : {}),
          }
        : undefined,
    ops:
      overrides.rushSkipUpsell !== undefined
        ? { rushSkipUpsell: overrides.rushSkipUpsell }
        : undefined,
    experiments:
      overrides.playbookVariant !== undefined
        ? { playbookVariant: overrides.playbookVariant }
        : undefined,
    rollout: { mode: "simulation" },
  });
}

export function describeVenueSimOverrides(
  overrides: VenueSimExperimentOverrides
): string {
  const parts: string[] = [];
  if (overrides.orderingFlow) parts.push(`flow=${overrides.orderingFlow}`);
  if (overrides.foodAfterDrinks !== undefined) {
    parts.push(`foodAfterDrinks=${overrides.foodAfterDrinks}`);
  }
  if (overrides.maxUpsellsPerSession !== undefined) {
    parts.push(`maxUpsells=${overrides.maxUpsellsPerSession}`);
  }
  if (overrides.rushSkipUpsell !== undefined) {
    parts.push(`rushSkipUpsell=${overrides.rushSkipUpsell}`);
  }
  if (overrides.playbookVariant) {
    parts.push(`playbook=${overrides.playbookVariant}`);
  }
  return parts.length ? parts.join(", ") : "simulation rollout only";
}
