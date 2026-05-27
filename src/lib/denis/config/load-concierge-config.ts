import { parsePartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  getCachedConciergeConfig,
  setCachedConciergeConfig,
} from "@/lib/denis/config/config-cache";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

type LocationConfigRow = {
  menu_locale: string;
  ai_concierge_config: unknown;
  organization: {
    ai_concierge_config: unknown;
  } | null;
};

export type LoadConciergeConfigOptions = {
  bypassCache?: boolean;
};

export async function loadConciergeConfigForLocation(
  locationId: string,
  options?: LoadConciergeConfigOptions
): Promise<ConciergeConfig> {
  if (!options?.bypassCache) {
    const cached = await getCachedConciergeConfig(locationId);
    if (cached) return cached;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select(
      "menu_locale, ai_concierge_config, organization:organizations(ai_concierge_config)"
    )
    .eq("id", locationId)
    .maybeSingle();

  if (error || !data) {
    logger.warn("Concierge config location load failed — using platform defaults", {
      locationId,
      error: error?.message ?? "not found",
    });
    return resolveConciergeConfig({});
  }

  const row = data as unknown as LocationConfigRow;
  const orgPartial = parsePartialConciergeConfig(
    row.organization?.ai_concierge_config ?? null
  );
  const locationPartial = parsePartialConciergeConfig(
    row.ai_concierge_config ?? null
  );

  if (row.ai_concierge_config && !locationPartial) {
    logger.warn("Invalid location ai_concierge_config — ignoring override", {
      locationId,
    });
  }
  if (row.organization?.ai_concierge_config && !orgPartial) {
    logger.warn("Invalid org ai_concierge_config — ignoring override", {
      locationId,
    });
  }

  const config = resolveConciergeConfig({
    orgConfig: orgPartial,
    locationConfig: locationPartial,
    menuLocale: row.menu_locale,
  });

  await setCachedConciergeConfig(locationId, config);
  return config;
}

/** Map ConciergeConfig LLM fields to runtime values (env fallback when null). */
export function resolveConciergeLlmRuntime(config: ConciergeConfig): {
  model: string | undefined;
  fallbackModel: string | undefined;
  temperatureOrdering: number;
  temperatureRecommend: number;
  parseRetryAttempts: number;
  skipLlmWhenPossible: boolean;
} {
  return {
    model: config.llm.model?.trim() || undefined,
    fallbackModel: config.llm.fallbackModel?.trim() || undefined,
    temperatureOrdering: config.llm.temperatureOrdering,
    temperatureRecommend: config.llm.temperatureRecommend,
    parseRetryAttempts: config.llm.parseRetryAttempts,
    skipLlmWhenPossible: config.llm.skipLlmWhenPossible,
  };
}
