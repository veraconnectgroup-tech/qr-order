import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import { metricDateFromIso } from "@/lib/commerce/projections/rollup-anticipation-analytics";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionDailyRollupInput = {
  orgId: string;
  locationId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export function sessionCompletedDailyDelta(input: SessionDailyRollupInput): {
  metricDate: string;
  sessionsClosed: number;
  sessionRevenueTotal: number;
} | null {
  if (input.eventType !== COMMERCE_EVENT_TYPES.sessionCompleted) {
    return null;
  }

  const revenue =
    typeof input.payload.revenue === "number"
      ? input.payload.revenue
      : Number(input.payload.revenue);

  return {
    metricDate: metricDateFromIso(input.createdAt),
    sessionsClosed: 1,
    sessionRevenueTotal: Number.isFinite(revenue) ? Math.max(0, revenue) : 0,
  };
}

export async function upsertSessionCompletedDailyRollup(
  admin: SupabaseClient,
  input: SessionDailyRollupInput
): Promise<void> {
  const delta = sessionCompletedDailyDelta(input);
  if (!delta) {
    return;
  }

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily" as never)
    .select("sessions_closed, session_revenue_total")
    .eq("location_id", input.locationId)
    .eq("metric_date", delta.metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = existing as {
    sessions_closed?: number;
    session_revenue_total?: number;
  } | null;

  const { error: upsertError } = await admin
    .from("experience_analytics_daily" as never)
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: delta.metricDate,
        sessions_closed: (row?.sessions_closed ?? 0) + delta.sessionsClosed,
        session_revenue_total:
          Number(row?.session_revenue_total ?? 0) + delta.sessionRevenueTotal,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}
