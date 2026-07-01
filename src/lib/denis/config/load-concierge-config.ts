import { parsePartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  getCachedConciergeConfig,
  setCachedConciergeConfig,
} from "@/lib/denis/config/config-cache";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  applyConfigShadowPatch,
  getConfigShadow,
} from "@/lib/denis/config/config-shadow";
import {
  SKYLINE_PILOT_LOCATION_ID,
  TABLE_OS_PILOT_CONFIG_PATCH,
} from "@/lib/denis/config/pilot-wiring";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  countLocationCompletedSessions,
  RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS,
} from "@/lib/denis/config/count-location-completed-sessions";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLocationConciergeConfigRow } from "@/lib/supabase/parse-location-rows";

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

  const row = parseLocationConciergeConfigRow(data);
  const orgPartial = parsePartialConciergeConfig(
    row.organization?.ai_concierge_config ?? null
  );
  let locationPartial = parsePartialConciergeConfig(
    row.ai_concierge_config ?? null
  );

  if (locationId === SKYLINE_PILOT_LOCATION_ID) {
    locationPartial = mergePartialConciergeConfig(
      locationPartial,
      TABLE_OS_PILOT_CONFIG_PATCH
    );
  }

  const shadow = await getConfigShadow(locationId);
  if (shadow?.patch) {
    locationPartial = applyConfigShadowPatch(locationPartial, shadow.patch);
  }

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

  const completedSessions = await countLocationCompletedSessions(
    admin,
    locationId
  );
  const configWithRhythm = applyRhythmShadowAutoEnable(config, completedSessions);

  await setCachedConciergeConfig(locationId, configWithRhythm);
  return configWithRhythm;
}

/** C1 — auto shadow when enough session history (beliefs only, no behavior change). */
export function applyRhythmShadowAutoEnable(
  config: ConciergeConfig,
  completedSessions: number
): ConciergeConfig {
  if (completedSessions < RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS) {
    return config;
  }
  if (config.rhythm.mode !== "off") {
    return config;
  }

  return {
    ...config,
    rhythm: {
      ...config.rhythm,
      enabled: true,
      mode: "shadow",
    },
  };
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
