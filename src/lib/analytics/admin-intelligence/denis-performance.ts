import type { DenisPerformanceSnapshot } from "@/lib/analytics/admin-intelligence/types";
import {
  computeConversionRate,
  computeWaiterGapRate,
  countEscalationsFromTimeline,
  countSessionsWithWaiterGap,
} from "@/lib/operator/projections/helpers";

export function buildDenisPerformanceSnapshot(input: {
  sessionsCount: number;
  sessionsWithOrder: number;
  aiSessions: Array<{
    language: string | null;
    messages: Array<{ role: string }>;
  }>;
  timelineEvents: Array<{
    event_type: string;
    payload: unknown;
    ai_session_id?: string;
  }>;
  experienceRollup: {
    byNudgeKind: Record<string, number>;
    offerConversions: number;
    nudgeImpressions: number;
    byOutcome: Record<string, number>;
  };
  avgResponseMs: number | null;
}): DenisPerformanceSnapshot {
  const sessionsWithActivity = input.aiSessions.filter(
    (row) => (row.messages?.length ?? 0) > 0
  );
  const sessionsWithLanguage = input.aiSessions.filter((row) =>
    row.language?.trim()
  );

  const upsellByNudgeKind = Object.entries(input.experienceRollup.byNudgeKind)
    .map(([kind, impressions]) => {
      const conversions = Math.round(
        (input.experienceRollup.offerConversions *
          impressions) /
          Math.max(1, input.experienceRollup.nudgeImpressions)
      );
      return {
        kind,
        impressions,
        conversions,
        successRate:
          impressions > 0
            ? Math.round((conversions / impressions) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  const handoffCount = countEscalationsFromTimeline(input.timelineEvents);
  const sessionsWithGap = countSessionsWithWaiterGap(input.timelineEvents);

  return {
    upsellByNudgeKind,
    languageAccuracyPct:
      sessionsWithActivity.length > 0
        ? Math.round(
            (sessionsWithLanguage.length / sessionsWithActivity.length) * 1000
          ) / 10
        : 0,
    handoffRate:
      sessionsWithActivity.length > 0
        ? Math.round((handoffCount / sessionsWithActivity.length) * 1000) / 10
        : computeWaiterGapRate({
            sessionsWithActivity: sessionsWithActivity.length,
            sessionsWithGap,
          }) * 100,
    avgResponseMs: input.avgResponseMs,
    conversionRate: computeConversionRate(
      input.sessionsCount,
      input.sessionsWithOrder
    ),
  };
}
