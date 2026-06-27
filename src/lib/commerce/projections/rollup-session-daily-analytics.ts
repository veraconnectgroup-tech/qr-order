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
  convertedSessions: number;
  orderTimeSecondsTotal: number;
  returningGuestSessions: number;
} | null {
  if (input.eventType !== COMMERCE_EVENT_TYPES.sessionCompleted) {
    return null;
  }

  const revenue =
    typeof input.payload.revenue === "number"
      ? input.payload.revenue
      : Number(input.payload.revenue);

  const firstOrderLagSeconds =
    typeof input.payload.firstOrderLagSeconds === "number" &&
    Number.isFinite(input.payload.firstOrderLagSeconds)
      ? Math.max(0, Math.round(input.payload.firstOrderLagSeconds))
      : 0;

  const sessionRevenueTotal = Number.isFinite(revenue) ? Math.max(0, revenue) : 0;
  const isReturningGuest = input.payload.isReturningGuest === true;

  return {
    metricDate: metricDateFromIso(input.createdAt),
    sessionsClosed: 1,
    sessionRevenueTotal,
    convertedSessions: sessionRevenueTotal > 0 ? 1 : 0,
    orderTimeSecondsTotal: firstOrderLagSeconds,
    returningGuestSessions: isReturningGuest ? 1 : 0,
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
    .select(
      "sessions_closed, session_revenue_total, converted_sessions, order_time_seconds_total, returning_guest_sessions"
    )
    .eq("location_id", input.locationId)
    .eq("metric_date", delta.metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = existing as {
    sessions_closed?: number;
    session_revenue_total?: number;
    converted_sessions?: number;
    order_time_seconds_total?: number;
    returning_guest_sessions?: number;
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
        converted_sessions:
          (row?.converted_sessions ?? 0) + delta.convertedSessions,
        order_time_seconds_total:
          (row?.order_time_seconds_total ?? 0) + delta.orderTimeSecondsTotal,
        returning_guest_sessions:
          (row?.returning_guest_sessions ?? 0) + delta.returningGuestSessions,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}
