import { subDays, format } from "date-fns";
import {
  buildExperienceScore,
  dailyRowToScoreInput,
} from "@/lib/denis/analytics/experience-score";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExperienceScoreTickResult = {
  processed: number;
  updated: number;
  metricDate: string;
  errors: string[];
};

type DailyRow = {
  org_id: string;
  location_id: string;
  metric_date: string;
  sessions_closed: number;
  converted_sessions: number;
  abandoned_sessions: number;
  cart_corrections: number;
  repeated_questions: number;
  total_turns: number;
  t0_turns: number;
  llm_turns: number;
  order_time_seconds_total: number;
  returning_guest_sessions: number;
};

export async function runDenisExperienceScoreForLocation(
  admin: SupabaseClient,
  input: { locationId: string; metricDate: string }
): Promise<{ updated: boolean; score: number | null }> {
  const { data: row, error } = await admin
    .from("experience_analytics_daily" as never)
    .select(
      "org_id, location_id, metric_date, sessions_closed, converted_sessions, abandoned_sessions, cart_corrections, repeated_questions, total_turns, t0_turns, llm_turns, order_time_seconds_total, returning_guest_sessions"
    )
    .eq("location_id", input.locationId)
    .eq("metric_date", input.metricDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    return { updated: false, score: null };
  }

  const typed = row as DailyRow;
  if ((typed.sessions_closed ?? 0) <= 0) {
    return { updated: false, score: null };
  }

  const score = buildExperienceScore({
    date: input.metricDate,
    locationId: input.locationId,
    daily: dailyRowToScoreInput(typed),
  });

  const { error: updateError } = await admin
    .from("experience_analytics_daily" as never)
    .update({
      experience_score: score.overallScore,
      experience_score_components: score.components,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("location_id", input.locationId)
    .eq("metric_date", input.metricDate);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { updated: true, score: score.overallScore };
}

export async function runDenisExperienceScoreTick(
  admin: SupabaseClient,
  input?: { metricDate?: string; limit?: number }
): Promise<ExperienceScoreTickResult> {
  const metricDate =
    input?.metricDate ?? format(subDays(new Date(), 1), "yyyy-MM-dd");
  const limit = input?.limit ?? 200;
  const errors: string[] = [];
  let updated = 0;

  const { data: locations, error: locError } = await admin
    .from("locations")
    .select("id")
    .eq("is_active", true)
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  if (locError) {
    throw new Error(locError.message);
  }

  const locationIds = (locations ?? []).map(
    (row) => (row as { id: string }).id
  );

  for (const locationId of locationIds) {
    try {
      const result = await runDenisExperienceScoreForLocation(admin, {
        locationId,
        metricDate,
      });
      if (result.updated) updated += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "experience score failed";
      errors.push(`${locationId}: ${message}`);
      logger.warn("Denis experience score location failed", {
        locationId,
        metricDate,
        error: message,
      });
    }
  }

  return {
    processed: locationIds.length,
    updated,
    metricDate,
    errors,
  };
}
