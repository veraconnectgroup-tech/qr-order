import type { SupabaseClient } from "@supabase/supabase-js";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ADR-045 Restaurant tier — owner-authored durable house knowledge (facts,
 * rules, style), distinct from per-table staff hints (Shift tier,
 * ephemeral) and guest memory (per-guest, device-bound). This is the one
 * piece of "what this restaurant is like" that a human has to type or say,
 * not something Denis can infer from order data.
 */

export type RestaurantKnowledgeEntry = {
  id: string;
  text: string;
  source: "admin_text" | "owner_voice";
  createdAt: string;
};

const MAX_ACTIVE_ENTRIES = 200;
const CACHE_TTL_SECONDS = 60;

function cacheKey(locationId: string): string {
  return `denis:restaurant-knowledge:${locationId}`;
}

export async function loadActiveRestaurantKnowledge(
  admin: SupabaseClient,
  locationId: string
): Promise<RestaurantKnowledgeEntry[]> {
  const redis = getRedisClient();
  const key = cacheKey(locationId);

  if (redis) {
    try {
      const cached = await redis.get<RestaurantKnowledgeEntry[]>(key);
      if (cached) return cached;
    } catch (error) {
      logRedisDegradation("denis.restaurant_knowledge.read", error);
    }
  }

  const { data, error } = await admin
    .from("denis_restaurant_knowledge")
    .select("id, text, source, created_at")
    .eq("location_id", locationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ACTIVE_ENTRIES);

  if (error) {
    logger.warn("loadActiveRestaurantKnowledge failed", {
      locationId,
      error: error.message,
    });
    return [];
  }

  const entries: RestaurantKnowledgeEntry[] = (data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    text: (row as { text: string }).text,
    source: (row as { source: "admin_text" | "owner_voice" }).source,
    createdAt: (row as { created_at: string }).created_at,
  }));

  if (redis) {
    try {
      await redis.set(key, entries, { ex: CACHE_TTL_SECONDS });
    } catch (error) {
      logRedisDegradation("denis.restaurant_knowledge.write", error);
    }
  }

  return entries;
}

async function invalidateCache(locationId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(cacheKey(locationId));
  } catch (error) {
    logRedisDegradation("denis.restaurant_knowledge.invalidate", error);
  }
}

export async function addRestaurantKnowledge(
  admin: SupabaseClient,
  input: {
    locationId: string;
    text: string;
    source: "admin_text" | "owner_voice";
    createdByStaffId: string;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = input.text.trim();
  if (!text || text.length > 500) {
    return { ok: false, error: "invalid_text" };
  }

  const { data, error } = await admin
    .from("denis_restaurant_knowledge")
    .insert({
      location_id: input.locationId,
      text,
      source: input.source,
      created_by_staff_id: input.createdByStaffId,
    })
    .select("id")
    .single();

  if (error) {
    logger.warn("addRestaurantKnowledge failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return { ok: false, error: "insert_failed" };
  }

  await invalidateCache(input.locationId);
  return { ok: true, id: (data as { id: string }).id };
}

export async function archiveRestaurantKnowledge(
  admin: SupabaseClient,
  input: { id: string; locationId: string }
): Promise<boolean> {
  const { error } = await admin
    .from("denis_restaurant_knowledge")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("location_id", input.locationId);

  if (error) {
    logger.warn("archiveRestaurantKnowledge failed", {
      id: input.id,
      locationId: input.locationId,
      error: error.message,
    });
    return false;
  }

  await invalidateCache(input.locationId);
  return true;
}

/** Formatted for a system-prompt block — null when there's nothing to say. */
export function formatRestaurantKnowledgeBlock(
  entries: RestaurantKnowledgeEntry[]
): string | null {
  if (entries.length === 0) return null;
  return [
    "RESTAURANT KNOWLEDGE (things the owner/staff told you to always know):",
    ...entries.map((entry) => `- ${entry.text}`),
  ].join("\n");
}

/** Convenience one-liner for prompt-building call sites — mirrors getPlaybookPromptBlock's own admin-client-internal shape. */
export async function loadRestaurantKnowledgeBlock(
  locationId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const entries = await loadActiveRestaurantKnowledge(admin, locationId);
  return formatRestaurantKnowledgeBlock(entries);
}
