import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

export const CONFIG_SHADOW_TTL_SECONDS = 30 * 60;

export type ConfigShadowRecord = {
  patch: PartialConciergeConfig;
  appliedAt: string;
  appliedBy: string;
  changeNote?: string;
  expiresAt: string;
};

function configShadowKey(locationId: string): string {
  return `denis:config-shadow:${locationId}`;
}

export function applyConfigShadowPatch(
  locationPartial: PartialConciergeConfig | null | undefined,
  shadowPatch: PartialConciergeConfig | null | undefined
): PartialConciergeConfig | null {
  if (!shadowPatch) {
    return locationPartial ?? null;
  }
  return mergePartialConciergeConfig(locationPartial, shadowPatch);
}

export async function getConfigShadow(
  locationId: string
): Promise<ConfigShadowRecord | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<ConfigShadowRecord>(configShadowKey(locationId));
    if (!raw?.patch || !raw.expiresAt) return null;
    if (Date.parse(raw.expiresAt) <= Date.now()) {
      await redis.del(configShadowKey(locationId));
      return null;
    }
    return raw;
  } catch (error) {
    logRedisDegradation(`config-shadow:read:${locationId}`, error);
    return null;
  }
}

export async function setConfigShadow(
  locationId: string,
  input: {
    patch: PartialConciergeConfig;
    appliedBy: string;
    changeNote?: string;
  }
): Promise<ConfigShadowRecord | null> {
  const parsed = parsePartialConciergeConfig(input.patch);
  if (!parsed) return null;

  const redis = getAiRedis();
  if (!redis) return null;

  const appliedAt = new Date().toISOString();
  const record: ConfigShadowRecord = {
    patch: parsed,
    appliedAt,
    appliedBy: input.appliedBy,
    changeNote: input.changeNote,
    expiresAt: new Date(Date.now() + CONFIG_SHADOW_TTL_SECONDS * 1000).toISOString(),
  };

  try {
    await redis.set(configShadowKey(locationId), record, {
      ex: CONFIG_SHADOW_TTL_SECONDS,
    });
    await invalidateConciergeConfigCache(locationId);
    logger.info("Denis config shadow enabled", {
      locationId,
      appliedBy: input.appliedBy,
    });
    return record;
  } catch (error) {
    logRedisDegradation(`config-shadow:write:${locationId}`, error);
    return null;
  }
}

export async function clearConfigShadow(locationId: string): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(configShadowKey(locationId));
    await invalidateConciergeConfigCache(locationId);
    logger.info("Denis config shadow cleared", { locationId });
  } catch (error) {
    logRedisDegradation(`config-shadow:clear:${locationId}`, error);
  }
}
