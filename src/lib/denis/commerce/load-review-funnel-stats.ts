import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import {
  buildReviewFunnelInsight,
  type ReviewFunnelInsight,
} from "@/lib/denis/commerce/review-intelligence";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadReviewFunnelInsight(
  admin: SupabaseClient,
  input: {
    locationId: string;
    fromIso: string;
    toIso: string;
  }
): Promise<ReviewFunnelInsight> {
  const [{ count: positiveFeedbackCount }, { count: googleReviewClickCount }, clickedSessionsResult] =
    await Promise.all([
      admin
        .from("order_feedback")
        .select("id", { count: "exact", head: true })
        .eq("location_id", input.locationId)
        .eq("sentiment", "positive")
        .gte("created_at", input.fromIso)
        .lte("created_at", input.toIso),
      admin
        .from("commerce_experience_events")
        .select("id", { count: "exact", head: true })
        .eq("location_id", input.locationId)
        .eq("event_type", COMMERCE_EVENT_TYPES.reviewGoogleClicked)
        .gte("created_at", input.fromIso)
        .lte("created_at", input.toIso),
      admin
        .from("commerce_experience_events")
        .select("session_id")
        .eq("location_id", input.locationId)
        .eq("event_type", COMMERCE_EVENT_TYPES.reviewGoogleClicked)
        .gte("created_at", input.fromIso)
        .lte("created_at", input.toIso),
    ]);

  const clickedSessionIds = new Set(
    ((clickedSessionsResult.data ?? []) as Array<{ session_id: string }>).map(
      (row) => row.session_id
    )
  );

  return buildReviewFunnelInsight({
    positiveFeedbackCount: positiveFeedbackCount ?? 0,
    googleReviewClickCount: googleReviewClickCount ?? 0,
    clickedSessionCount: clickedSessionIds.size,
  });
}
