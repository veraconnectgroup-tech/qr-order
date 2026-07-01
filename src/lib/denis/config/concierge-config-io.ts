import {
  ConciergeConfigSchema,
  PartialConciergeConfigSchema,
  type ConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

export type ConciergeConfigExport = {
  exportedAt: string;
  schemaVersion: 1;
  kind: "concierge_config";
  config: PartialConciergeConfig | ConciergeConfig;
};

export function exportConciergeConfig(
  config: PartialConciergeConfig | ConciergeConfig
): string {
  const payload: ConciergeConfigExport = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    kind: "concierge_config",
    config,
  };
  return JSON.stringify(payload, null, 2);
}

export function importConciergeConfig(json: string):
  | { ok: true; config: PartialConciergeConfig }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Expected a JSON object." };
  }

  const body = parsed as Record<string, unknown>;
  const configCandidate =
    body.kind === "concierge_config" && body.config && typeof body.config === "object"
      ? body.config
      : parsed;

  const partial = PartialConciergeConfigSchema.safeParse(configCandidate);
  if (partial.success) {
    return { ok: true, config: partial.data };
  }

  const full = ConciergeConfigSchema.safeParse(configCandidate);
  if (full.success) {
    return { ok: true, config: full.data };
  }

  return { ok: false, error: "Config does not match concierge schema." };
}

export function exportPlatformDefaultsJson(): string {
  return exportConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS);
}
