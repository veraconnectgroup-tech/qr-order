import {
  ConciergeConfigSchema,
  PartialConciergeConfigSchema,
  type ConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeConciergeLayer(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      merged[key] = value;
      continue;
    }

    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeConciergeLayer(
        merged[key] as Record<string, unknown>,
        value
      );
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

/** Deep-merge partial location/org overrides (M25 admin saves). */
export function mergePartialConciergeConfig(
  base: PartialConciergeConfig | null | undefined,
  patch: PartialConciergeConfig
): PartialConciergeConfig {
  const merged = mergeConciergeLayer(
    structuredClone((base ?? {}) as Record<string, unknown>),
    patch as Record<string, unknown>
  );
  return PartialConciergeConfigSchema.parse(merged);
}

/** Deep merge with array replace — platform → org → location. */
export function mergeConciergeConfig(
  platform: ConciergeConfig = CONCIERGE_PLATFORM_DEFAULTS,
  org: PartialConciergeConfig | null | undefined,
  location: PartialConciergeConfig | null | undefined
): ConciergeConfig {
  const merged = mergeConciergeLayer(
    structuredClone(platform) as unknown as Record<string, unknown>,
    (org ?? {}) as Record<string, unknown>
  );

  const withLocation = mergeConciergeLayer(
    merged,
    (location ?? {}) as Record<string, unknown>
  );

  return ConciergeConfigSchema.parse(withLocation);
}

/** Live ACT when venue runs Denis-only — architecture promise = waiter can submit (ADR-032). */
function applyRolloutOrderingDefaults(config: ConciergeConfig): ConciergeConfig {
  if (config.rollout.mode !== "denis_only") {
    return config;
  }

  return {
    ...config,
    ordering: {
      ...config.ordering,
      actLayerEnabled: true,
      actDryRun: false,
      actSubmitEnabled: true,
    },
  };
}

export type ResolveConciergeConfigInput = {
  orgConfig?: PartialConciergeConfig | null;
  locationConfig?: PartialConciergeConfig | null;
  menuLocale?: string | null;
};

/**
 * Resolve merged config for a location.
 * Applies menu locale to language.venueDefault when location did not override it.
 */
export function resolveConciergeConfig(
  input: ResolveConciergeConfigInput = {}
): ConciergeConfig {
  const config = applyRolloutOrderingDefaults(
    mergeConciergeConfig(
      CONCIERGE_PLATFORM_DEFAULTS,
      input.orgConfig,
      input.locationConfig
    )
  );

  if (input.locationConfig?.language?.venueDefault) {
    return config;
  }

  const menuLocale = input.menuLocale?.trim().slice(0, 2);
  if (!menuLocale) {
    return config;
  }

  return {
    ...config,
    language: {
      ...config.language,
      venueDefault: menuLocale,
    },
  };
}
