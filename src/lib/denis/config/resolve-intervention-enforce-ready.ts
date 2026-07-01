import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";

/** ADR-041 P3 — enforce requires UPDS R1 pairing (GMM enforce + offer enrich). */
export function getInterventionEnforceViolations(
  config: ConciergeConfig
): string[] {
  const violations: string[] = [];

  if (resolveMentalModelMode(config) !== "enforce") {
    violations.push("mentalModel.mode must be enforce");
  }

  if (!config.proactive.offerEnrich) {
    violations.push("proactive.offerEnrich must be true");
  }

  return violations;
}

export function isInterventionEnforceReady(config: ConciergeConfig): boolean {
  return getInterventionEnforceViolations(config).length === 0;
}
