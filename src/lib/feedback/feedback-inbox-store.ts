import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * ADR-014 CE-2 — feedback_inbox gets dual-written by
 * finalize_commerce_experience_command alongside order_feedback, but
 * nothing ever read it: negative-sentiment feedback flagged
 * needs_response accumulated with zero admin-visible surface. This is the
 * first reader.
 */
export type FeedbackInboxItem = {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  category: "food" | "service" | "wait_time" | "other" | null;
  rating: number | null;
  comment: string | null;
  createdAt: string;
};

export async function loadFeedbackInboxNeedingResponse(
  admin: SupabaseClient,
  locationId: string
): Promise<FeedbackInboxItem[]> {
  const { data, error } = await admin
    .from("feedback_inbox")
    .select("id, sentiment, category, rating, comment, created_at")
    .eq("location_id", locationId)
    .eq("needs_response", true)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("loadFeedbackInboxNeedingResponse failed", {
      locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      sentiment: "positive" | "neutral" | "negative";
      category: "food" | "service" | "wait_time" | "other" | null;
      rating: number | null;
      comment: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      sentiment: r.sentiment,
      category: r.category,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    };
  });
}

export async function markFeedbackInboxHandled(
  admin: SupabaseClient,
  input: { id: string; locationId: string; staffId: string }
): Promise<boolean> {
  const { error } = await admin
    .from("feedback_inbox")
    .update({
      needs_response: false,
      responded_by: input.staffId,
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("location_id", input.locationId);

  if (error) {
    logger.warn("markFeedbackInboxHandled failed", {
      id: input.id,
      error: error.message,
    });
    return false;
  }
  return true;
}
