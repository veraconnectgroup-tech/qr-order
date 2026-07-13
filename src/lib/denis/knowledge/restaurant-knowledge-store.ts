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
    .eq("status", "confirmed")
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

/**
 * Permanent-rule-vs-one-time-exception state machine (00167 migration,
 * Architecture Proposal §7). Founder's own decision: a colleague's answer
 * is never enough on its own to durably change house knowledge — every
 * proposal lands in 'pending_confirmation', never auto-'confirmed', no
 * matter who answered. Denis may still apply it for the CURRENT order
 * immediately (a one-time application, logged to denis_timeline as
 * rule.applied_once elsewhere — never written here, never a status this
 * table has).
 */
export type RestaurantKnowledgeProposal = {
  id: string;
  text: string;
  proposedByStaffId: string | null;
  sourceAiSessionId: string | null;
  createdAt: string;
  pendingExpiresAt: string | null;
};

const PENDING_EXPIRY_DAYS = 14;

export async function proposeRestaurantRule(
  admin: SupabaseClient,
  input: {
    locationId: string;
    text: string;
    proposedByStaffId: string | null;
    sourceAiSessionId?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = input.text.trim();
  if (!text || text.length > 500) {
    return { ok: false, error: "invalid_text" };
  }

  const pendingExpiresAt = new Date(
    Date.now() + PENDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from("denis_restaurant_knowledge")
    .insert({
      location_id: input.locationId,
      text,
      source: "owner_voice",
      status: "pending_confirmation",
      scope: "permanent",
      proposed_by_staff_id: input.proposedByStaffId,
      source_ai_session_id: input.sourceAiSessionId ?? null,
      pending_expires_at: pendingExpiresAt,
    })
    .select("id")
    .single();

  if (error) {
    logger.warn("proposeRestaurantRule failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true, id: (data as { id: string }).id };
}

export async function listPendingRestaurantKnowledgeProposals(
  admin: SupabaseClient,
  locationId: string
): Promise<RestaurantKnowledgeProposal[]> {
  const { data, error } = await admin
    .from("denis_restaurant_knowledge")
    .select("id, text, proposed_by_staff_id, source_ai_session_id, created_at, pending_expires_at")
    .eq("location_id", locationId)
    .eq("status", "pending_confirmation")
    .order("created_at", { ascending: true });

  if (error) {
    logger.warn("listPendingRestaurantKnowledgeProposals failed", {
      locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      text: string;
      proposed_by_staff_id: string | null;
      source_ai_session_id: string | null;
      created_at: string;
      pending_expires_at: string | null;
    };
    return {
      id: r.id,
      text: r.text,
      proposedByStaffId: r.proposed_by_staff_id,
      sourceAiSessionId: r.source_ai_session_id,
      createdAt: r.created_at,
      pendingExpiresAt: r.pending_expires_at,
    };
  });
}

/** requireAdmin() must be enforced by the caller — this only performs the write. */
export async function confirmRestaurantRuleProposal(
  admin: SupabaseClient,
  input: { id: string; locationId: string; confirmedByStaffId: string }
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" | "update_failed" }> {
  const { data: row } = await admin
    .from("denis_restaurant_knowledge")
    .select("id, status")
    .eq("id", input.id)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };
  if ((row as { status: string }).status !== "pending_confirmation") {
    return { ok: false, error: "not_pending" };
  }

  const { error } = await admin
    .from("denis_restaurant_knowledge")
    .update({
      status: "confirmed",
      confirmed_by_staff_id: input.confirmedByStaffId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("status", "pending_confirmation");

  if (error) return { ok: false, error: "update_failed" };

  await invalidateCache(input.locationId);
  return { ok: true };
}

/** requireAdmin() must be enforced by the caller — this only performs the write. */
export async function rejectRestaurantRuleProposal(
  admin: SupabaseClient,
  input: { id: string; locationId: string }
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" | "update_failed" }> {
  const { data: row } = await admin
    .from("denis_restaurant_knowledge")
    .select("id, status")
    .eq("id", input.id)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };
  if ((row as { status: string }).status !== "pending_confirmation") {
    return { ok: false, error: "not_pending" };
  }

  const { error } = await admin
    .from("denis_restaurant_knowledge")
    .update({ status: "rejected" })
    .eq("id", input.id)
    .eq("status", "pending_confirmation");

  if (error) return { ok: false, error: "update_failed" };
  return { ok: true };
}

/** Nightly-job entry point — pending proposals nobody acted on eventually expire. */
export async function expireOverduePendingRestaurantKnowledge(
  admin: SupabaseClient,
  nowMs?: number
): Promise<{ expired: number }> {
  const now = new Date(nowMs ?? Date.now()).toISOString();

  const { data, error } = await admin
    .from("denis_restaurant_knowledge")
    .update({ status: "expired" })
    .eq("status", "pending_confirmation")
    .lt("pending_expires_at", now)
    .select("id");

  if (error) {
    logger.warn("expireOverduePendingRestaurantKnowledge failed", {
      error: error.message,
    });
    return { expired: 0 };
  }

  return { expired: (data ?? []).length };
}
