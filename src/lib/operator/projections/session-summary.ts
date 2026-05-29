import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countUserMessages,
  extractIntentsFromTimeline,
  redactTranscript,
  resolveSessionOutcome,
} from "@/lib/operator/projections/helpers";
import type { OperatorSessionSummary } from "@/lib/operator/types";

export async function projectOperatorSessionSummary(
  admin: SupabaseClient,
  input: {
    orgId: string;
    sessionId: string;
    includeTranscript?: boolean;
  }
): Promise<OperatorSessionSummary | null> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select(
      "id, location_id, status, opened_at, closed_at, denis_shared_ai_session_id"
    )
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!sessionRow) return null;

  const session = sessionRow as {
    id: string;
    location_id: string;
    status: string;
    opened_at: string;
    closed_at: string | null;
    denis_shared_ai_session_id: string | null;
  };

  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", session.location_id)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  const { count: ordersCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .neq("status", "cancelled");

  let messages: Array<{ role: string; content: string }> = [];
  let language: string | null = null;
  let timelineEvents: Array<{ event_type: string; payload: unknown }> = [];

  if (session.denis_shared_ai_session_id) {
    const { data: aiRow } = await admin
      .from("ai_sessions")
      .select("language, messages")
      .eq("id", session.denis_shared_ai_session_id)
      .eq("org_id", input.orgId)
      .maybeSingle();

    if (aiRow) {
      const ai = aiRow as {
        language: string;
        messages: Array<{ role: string; content: string }>;
      };
      language = ai.language;
      messages = ai.messages ?? [];
    }

    const { data: timelineRows } = await admin
      .from("denis_timeline")
      .select("event_type, payload")
      .eq("ai_session_id", session.denis_shared_ai_session_id)
      .order("seq", { ascending: true });
    timelineEvents = (timelineRows ?? []) as typeof timelineEvents;
  }

  const handoffCount = timelineEvents.filter((event) => {
    if (event.event_type !== "intent.resolved") return false;
    const payload = event.payload as { intent?: string } | null;
    return (
      payload?.intent === "HANDOFF_WAITER" || payload?.intent === "HANDOFF_PAY"
    );
  }).length;

  const summary: OperatorSessionSummary = {
    sessionId: session.id,
    locationId: session.location_id,
    status: session.status,
    outcome: resolveSessionOutcome({
      status: session.status,
      ordersCount: ordersCount ?? 0,
      handoffCount,
    }),
    openedAt: session.opened_at,
    closedAt: session.closed_at,
    turnCount: countUserMessages(messages),
    messageCount: messages.length,
    language,
    intents: extractIntentsFromTimeline(timelineEvents),
    ordersCount: ordersCount ?? 0,
  };

  if (input.includeTranscript) {
    summary.transcript = redactTranscript(messages);
  }

  return summary;
}
