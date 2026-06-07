import {
  DEFAULT_INTERVENTION_MANIFEST,
  INTERVENTION_MANIFEST_VERSION,
} from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";

const INTERVENTION_MANIFEST_REGISTRY: Record<string, InterventionManifest> = {
  [INTERVENTION_MANIFEST_VERSION]: DEFAULT_INTERVENTION_MANIFEST,
};

/** Lookup promoted intervention manifest by version id (ADR-041 P3). */
export function lookupInterventionManifest(
  version: string | null | undefined
): InterventionManifest | null {
  if (!version) return null;
  return INTERVENTION_MANIFEST_REGISTRY[version] ?? null;
}

export function listInterventionManifestVersions(): string[] {
  return Object.keys(INTERVENTION_MANIFEST_REGISTRY);
}
