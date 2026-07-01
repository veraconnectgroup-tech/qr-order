import {
  DEFAULT_INTERVENTION_MANIFEST,
  INTERVENTION_MANIFEST_VERSION,
} from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import { lookupInterventionManifest } from "@/lib/denis/cognition/intervention/intervention-manifest-registry";
import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

/** Resolve active intervention manifest — platform default or promoted version (ADR-041 P3). */
export function resolveInterventionManifest(
  config: ConciergeConfig
): InterventionManifest {
  const promoted = lookupInterventionManifest(config.intervention.manifestVersion);
  return promoted ?? DEFAULT_INTERVENTION_MANIFEST;
}

export function resolveInterventionManifestVersion(
  config: ConciergeConfig
): string {
  return (
    config.intervention.manifestVersion?.trim() || INTERVENTION_MANIFEST_VERSION
  );
}
