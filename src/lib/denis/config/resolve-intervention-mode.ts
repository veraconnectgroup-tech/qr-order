import { isInterventionEnforceReady } from "@/lib/denis/config/resolve-intervention-enforce-ready";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { InterventionMode } from "@/lib/denis/config/intervention-mode";

function resolveRawInterventionMode(config: ConciergeConfig): InterventionMode {
  const { enabled, mode } = config.intervention;
  if (mode === "shadow" || mode === "enforce") {
    return mode;
  }
  if (enabled) {
    return "shadow";
  }
  return "off";
}

/** Resolve intervention journal mode (ADR-041). Default off. */
export function resolveInterventionMode(config: ConciergeConfig): InterventionMode {
  const raw = resolveRawInterventionMode(config);
  if (raw === "enforce" && !isInterventionEnforceReady(config)) {
    return "shadow";
  }
  return raw;
}

/** Configured mode before enforce pairing downgrade (audit / promote gate). */
export function resolveInterventionConfiguredMode(
  config: ConciergeConfig
): InterventionMode {
  return resolveRawInterventionMode(config);
}

export function isInterventionJournalActive(config: ConciergeConfig): boolean {
  return resolveInterventionMode(config) !== "off";
}
