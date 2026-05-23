import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  averageRating,
  formatAverageRating,
  type FeedbackWithOrder,
} from "@/lib/feedback/feedback";
import { formatAnalyticsRangeLabel, type AnalyticsDateRange } from "@/lib/analytics/date-range";

export async function FeedbackRatingKpiCard({
  range,
}: {
  range: AnalyticsDateRange;
}) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return null;

  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("order_feedback")
    .select("rating")
    .eq("location_id", locationId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());

  const feedback = (rows ?? []) as Array<{ rating: number }>;
  const avg = averageRating(feedback);
  const count = feedback.length;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">
        Average rating ({formatAnalyticsRangeLabel(range).toLowerCase()})
      </p>
      <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">
        {formatAverageRating(avg)}
        <span className="ml-1 text-lg font-normal text-neutral-400">/ 5</span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {count} {count === 1 ? "rating" : "ratings"} · post-delivery
      </p>
    </div>
  );
}

export async function loadLocationFeedback(
  locationId: string
): Promise<FeedbackWithOrder[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("order_feedback")
    .select("id, order_id, location_id, rating, comment, created_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    order_id: string;
    location_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }>;

  if (!rows.length) return [];

  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number")
    .in("id", orderIds);

  const orderNumbers = new Map(
    ((orders ?? []) as Array<{ id: string; order_number: number }>).map(
      (order) => [order.id, order.order_number]
    )
  );

  return rows.map((row) => ({
    ...row,
    order_number: orderNumbers.get(row.order_id) ?? 0,
  }));
}
