import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";
import type { SupabaseClient } from "@supabase/supabase-js";

function mapFeedbackRow(row: {
  rating: number;
  sentiment: string | null;
  category: string | null;
  created_at: string;
}): FeedbackRow | null {
  const sentiment = row.sentiment;
  if (
    sentiment !== "positive" &&
    sentiment !== "neutral" &&
    sentiment !== "negative"
  ) {
    return null;
  }

  const category =
    row.category === "food" ||
    row.category === "service" ||
    row.category === "wait_time" ||
    row.category === "other"
      ? row.category
      : null;

  return {
    rating: row.rating,
    sentiment,
    category,
    createdAt: row.created_at,
  };
}

/** Load order_feedback rows for analytics (owner digest + copilot). */
export async function loadLocationFeedbackRows(
  admin: SupabaseClient,
  input: {
    locationId: string;
    lookbackDays: number;
  }
): Promise<FeedbackRow[]> {
  const since = new Date(
    Date.now() - input.lookbackDays * 2 * 86_400_000
  ).toISOString();

  const { data, error } = await admin
    .from("order_feedback")
    .select("rating, sentiment, category, created_at")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows: FeedbackRow[] = [];
  for (const row of data as Array<{
    rating: number;
    sentiment: string | null;
    category: string | null;
    created_at: string;
  }>) {
    const mapped = mapFeedbackRow(row);
    if (mapped) rows.push(mapped);
  }
  return rows;
}
