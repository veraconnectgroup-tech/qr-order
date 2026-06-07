import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeConversionRate,
  computeLlmInvocationRate,
  computeWaiterGapRate,
  countEscalationsFromTimeline,
  countSessionsWithWaiterGap,
  topLanguagesFromSessions,
} from "@/lib/operator/projections/helpers";
import {
  parseOperatorPeriod,
  periodToIsoRange,
} from "@/lib/operator/parse-period";
import type { DenisLocationMetrics, OperatorPeriod } from "@/lib/operator/types";

export async function projectDenisLocationMetrics(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    period?: OperatorPeriod | string | null;
  }
): Promise<DenisLocationMetrics | null> {
  const bounds = parseOperatorPeriod(input.period ?? "today");
  const range = periodToIsoRange(bounds);

  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  const { data: tableSessions } = await admin
    .from("table_sessions")
    .select("id, denis_shared_ai_session_id")
    .eq("location_id", input.locationId)
    .gte("opened_at", range.from)
    .lte("opened_at", range.to);

  const sessions = tableSessions ?? [];
  const aiSessionIds = [
    ...new Set(
      sessions
        .map((row) => (row as { denis_shared_ai_session_id: string | null }).denis_shared_ai_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const sessionIds = sessions.map((row) => (row as { id: string }).id);

  let sessionsWithOrder = 0;
  if (sessionIds.length) {
    const { data: orderRows } = await admin
      .from("orders")
      .select("session_id")
      .eq("location_id", input.locationId)
      .in("session_id", sessionIds)
      .neq("status", "cancelled");
    sessionsWithOrder = new Set(
      ((orderRows ?? []) as Array<{ session_id: string | null }>)
        .map((row) => row.session_id)
        .filter((id): id is string => Boolean(id))
    ).size;
  }

  let aiSessions: Array<{
    id: string;
    language: string;
    messages: Array<{ role: string }>;
    credits_used: number;
  }> = [];

  if (aiSessionIds.length) {
    const { data } = await admin
      .from("ai_sessions")
      .select("id, language, messages, credits_used")
      .eq("org_id", input.orgId)
      .in("id", aiSessionIds);
    aiSessions = (data ?? []) as typeof aiSessions;
  }

  const sessionsWithActivity = aiSessions.filter(
    (row) => (row.messages?.length ?? 0) > 0
  );
  const sessionsWithLlm = aiSessions.filter((row) => row.credits_used > 0);
  const totalTurns = aiSessions.reduce(
    (sum, row) =>
      sum + (row.messages?.filter((message) => message.role === "user").length ?? 0),
    0
  );
  const totalCredits = aiSessions.reduce((sum, row) => sum + row.credits_used, 0);

  let escalationsCount = 0;
  let sessionsWithGap = 0;
  if (aiSessionIds.length) {
    const { data: timelineRows } = await admin
      .from("denis_timeline")
      .select("event_type, payload, ai_session_id")
      .in("ai_session_id", aiSessionIds)
      .gte("created_at", range.from)
      .lte("created_at", range.to);
    const timelineEvents = (timelineRows ?? []) as Array<{
      event_type: string;
      payload: unknown;
      ai_session_id: string;
    }>;
    escalationsCount = countEscalationsFromTimeline(timelineEvents);
    sessionsWithGap = countSessionsWithWaiterGap(timelineEvents);
  }

  const { data: orgOps } = await admin
    .from("org_ai_ops")
    .select("credit_balance, low_balance")
    .eq("org_id", input.orgId)
    .maybeSingle();

  const ops = orgOps as {
    credit_balance?: number;
    low_balance?: boolean;
  } | null;

  const sessionsCount = sessions.length;

  return {
    locationId: input.locationId,
    period: range,
    sessionsCount,
    sessionsWithDenisActivity: sessionsWithActivity.length,
    sessionsWithOrder,
    conversionRate: computeConversionRate(sessionsCount, sessionsWithOrder),
    llmInvocationRate: computeLlmInvocationRate({
      sessionsWithActivity: sessionsWithActivity.length,
      sessionsWithLlm: sessionsWithLlm.length,
    }),
    waiterGapRate: computeWaiterGapRate({
      sessionsWithActivity: sessionsWithActivity.length,
      sessionsWithGap,
    }),
    avgTurnsPerSession:
      sessionsCount > 0 ? Math.round((totalTurns / sessionsCount) * 10) / 10 : 0,
    avgCreditsPerSession:
      aiSessions.length > 0
        ? Math.round((totalCredits / aiSessions.length) * 10) / 10
        : 0,
    escalationsCount,
    topLanguages: topLanguagesFromSessions(aiSessions),
    creditBalance: ops?.credit_balance ?? null,
    lowBalance: ops?.low_balance ?? false,
  };
}
