import { AI_CONFIG } from "@/lib/ai/config";
import { formatPlaybookBlock } from "@/lib/ai/playbook/format-examples";
import type { AiPlaybookPayload } from "@/lib/ai/playbook/types";
import { getAiRedis } from "@/lib/ai/redis";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

function playbookCacheKey(locationId: string) {
  return `${AI_CONFIG.playbookCacheKeyPrefix}${locationId}`;
}

async function loadPlaybookFromDb(
  orgId: string,
  locationId: string
): Promise<AiPlaybookPayload> {
  const admin = createAdminClient();

  const [{ data: location }, { data: examples, error }] = await Promise.all([
    admin
      .from("locations")
      .select("ai_playbook")
      .eq("id", locationId)
      .single(),
    admin
      .from("ai_examples")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .or(`location_id.eq.${locationId},location_id.is.null`)
      .order("sort_order")
      .order("created_at"),
  ]);

  if (error) {
    throw new Error(`AI examples load failed: ${error.message}`);
  }

  const activeExamples = ((examples ?? []) as AiPlaybookPayload["examples"]).slice(
    0,
    AI_CONFIG.maxPlaybookExamples
  );

  const playbook =
    (location as { ai_playbook: string | null } | null)?.ai_playbook?.trim() ||
    null;

  return {
    playbook,
    examples: activeExamples,
    cachedAt: new Date().toISOString(),
  };
}

export async function getCachedPlaybookForLocation(
  orgId: string,
  locationId: string,
  options?: { bypassCache?: boolean }
): Promise<AiPlaybookPayload> {
  const cacheKey = playbookCacheKey(locationId);
  const redis = getAiRedis();

  if (redis && !options?.bypassCache) {
    try {
      const cached = await redis.get<AiPlaybookPayload>(cacheKey);
      if (cached?.cachedAt) {
        return cached;
      }
    } catch (error) {
      logger.warn("AI playbook cache read failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const payload = await loadPlaybookFromDb(orgId, locationId);

  if (redis) {
    try {
      await redis.set(cacheKey, payload, {
        ex: AI_CONFIG.playbookCacheTtlSeconds,
      });
    } catch (error) {
      logger.warn("AI playbook cache write failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return payload;
}

export async function getPlaybookPromptBlock(
  orgId: string,
  locationId: string
): Promise<string | null> {
  const payload = await getCachedPlaybookForLocation(orgId, locationId);
  return formatPlaybookBlock(payload.playbook, payload.examples);
}
