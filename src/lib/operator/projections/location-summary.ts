import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAvgCheckCents,
  computeConversionRate,
  computeLlmInvocationRate,
  computeTipRate,
  computeWaiterGapRate,
  countEscalationsFromTimeline,
  countSessionsWithWaiterGap,
  decimalToCents,
  topLanguagesFromSessions,
} from "@/lib/operator/projections/helpers";
import {
  parseOperatorPeriod,
  periodToIsoRange,
} from "@/lib/operator/parse-period";
import type { LocationSummary, OperatorPeriod } from "@/lib/operator/types";

type OrderRow = {
  id: string;
  session_id: string | null;
  total: number | string;
  tip_amount: number | string | null;
  payment_status: string;
};

type TableSessionRow = {
  id: string;
  denis_shared_ai_session_id: string | null;
};

type AiSessionRow = {
  id: string;
  language: string;
  messages: Array<{ role: string; content: string }>;
  credits_used: number;
};

export async function projectLocationSummary(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    period?: OperatorPeriod | string | null;
  }
): Promise<LocationSummary | null> {
  const bounds = parseOperatorPeriod(input.period ?? "today");
  const range = periodToIsoRange(bounds);

  const { data: location } = await admin
    .from("locations")
    .select("id, org_id, denis_operating_mode")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  const operatingMode = (location as { denis_operating_mode?: string })
    .denis_operating_mode;

  const { data: orderRows } = await admin
    .from("orders")
    .select("id, session_id, total, tip_amount, payment_status")
    .eq("location_id", input.locationId)
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .neq("status", "cancelled");

  const orders = (orderRows ?? []) as OrderRow[];
  const revenueCents = orders.reduce(
    (sum, row) => sum + decimalToCents(row.total),
    0
  );
  const paidOrders = orders.filter((row) => row.payment_status === "paid");
  const ordersWithTip = paidOrders.filter(
    (row) => decimalToCents(row.tip_amount) > 0
  );

  const sessionIdsWithOrder = new Set(
    orders
      .map((row) => row.session_id)
      .filter((id): id is string => Boolean(id))
  );

  const { data: tableSessions } = await admin
    .from("table_sessions")
    .select("id, denis_shared_ai_session_id")
    .eq("location_id", input.locationId)
    .gte("opened_at", range.from)
    .lte("opened_at", range.to);

  const sessions = (tableSessions ?? []) as TableSessionRow[];
  const aiSessionIds = [
    ...new Set(
      sessions
        .map((row) => row.denis_shared_ai_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let aiSessions: AiSessionRow[] = [];
  if (aiSessionIds.length) {
    const { data } = await admin
      .from("ai_sessions")
      .select("id, language, messages, credits_used")
      .eq("org_id", input.orgId)
      .in("id", aiSessionIds);
    aiSessions = (data ?? []) as AiSessionRow[];
  }

  const sessionsWithActivity = aiSessions.filter(
    (row) => (row.messages?.length ?? 0) > 0
  );
  const sessionsWithLlm = aiSessions.filter((row) => row.credits_used > 0);
  const totalTurns = aiSessions.reduce(
    (sum, row) =>
      sum +
      (row.messages?.filter((message) => message.role === "user").length ?? 0),
    0
  );

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

  const { count: openWaiterCalls } = await admin
    .from("waiter_calls")
    .select("id", { count: "exact", head: true })
    .eq("location_id", input.locationId)
    .eq("status", "pending");

  const { count: kdsBacklog } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("location_id", input.locationId)
    .in("status", ["accepted", "preparing"]);

  const sessionsCount = sessions.length;
  const sessionsWithOrder = sessions.filter((row) =>
    sessionIdsWithOrder.has(row.id)
  ).length;

  return {
    locationId: input.locationId,
    period: range,
    commerce: {
      ordersCount: orders.length,
      revenueCents,
      avgCheckCents: computeAvgCheckCents(revenueCents, orders.length),
      tipRate: computeTipRate(ordersWithTip.length, paidOrders.length),
    },
    denis: {
      sessionsCount,
      sessionsWithOrder,
      conversionRate: computeConversionRate(sessionsCount, sessionsWithOrder),
      escalationsCount,
      avgTurnsPerSession:
        sessionsCount > 0
          ? Math.round((totalTurns / sessionsCount) * 10) / 10
          : 0,
      topLanguages: topLanguagesFromSessions(aiSessions),
      llmInvocationRate: computeLlmInvocationRate({
        sessionsWithActivity: sessionsWithActivity.length,
        sessionsWithLlm: sessionsWithLlm.length,
      }),
      waiterGapRate: computeWaiterGapRate({
        sessionsWithActivity: sessionsWithActivity.length,
        sessionsWithGap,
      }),
    },
    ops: {
      rushMinutes: operatingMode === "rush" ? 1 : 0,
      openWaiterCalls: openWaiterCalls ?? 0,
      kdsBacklog: kdsBacklog ?? 0,
    },
  };
}
