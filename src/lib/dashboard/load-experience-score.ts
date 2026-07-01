import { subDays, format } from "date-fns";
import {
  detectExperienceScoreAlert,
  type ExperienceScoreAlert,
  type ExperienceScoreTrendPoint,
} from "@/lib/denis/analytics/experience-score";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExperienceScoreSnapshot = {
  periodDays: number;
  fromDate: string;
  toDate: string;
  latestScore: number | null;
  trend: ExperienceScoreTrendPoint[];
  alert: ExperienceScoreAlert | null;
};

export async function loadExperienceScoreSnapshot(
  admin: SupabaseClient,
  input: { locationId: string; periodDays?: number }
): Promise<ExperienceScoreSnapshot> {
  const periodDays = input.periodDays ?? 14;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");

  const { data, error } = await admin
    .from("experience_analytics_daily" as never)
    .select("metric_date, experience_score")
    .eq("location_id", input.locationId)
    .gte("metric_date", fromDate)
    .lte("metric_date", toDate)
    .order("metric_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const trend: ExperienceScoreTrendPoint[] = (data ?? [])
    .map((row) => {
      const typed = row as {
        metric_date: string;
        experience_score: number | null;
      };
      if (typed.experience_score == null) return null;
      return {
        date: typed.metric_date,
        score: Number(typed.experience_score),
      };
    })
    .filter((row): row is ExperienceScoreTrendPoint => row !== null);

  const latestScore =
    trend.length > 0 ? trend[trend.length - 1]?.score ?? null : null;

  return {
    periodDays,
    fromDate,
    toDate,
    latestScore,
    trend,
    alert: detectExperienceScoreAlert(trend),
  };
}
