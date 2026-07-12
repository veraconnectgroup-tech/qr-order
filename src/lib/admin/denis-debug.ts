import type { DenisSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import { buildSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import {
  buildDenisSessionReplay,
  type DenisSessionReplay,
} from "@/lib/admin/denis-session-replay";
import {
  buildDenisInsightsAggregate,
  collectUnknownIntentEdgeCases,
  type DenisInsightsAggregate,
} from "@/lib/admin/denis-insights-aggregate";
import {
  computeSessionConversationQuality,
} from "@/lib/admin/denis-session-replay";
import { loadSessionEvalResult } from "@/lib/denis/eval/continuous-eval-loop";
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import type { TurnTrace } from "@/lib/denis/runtime/turn-trace";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisDebugSessionRow = {
  id: string;
  tableId: string;
  tableName: string | null;
  status: string;
  language: string;
  createdAt: string;
  timelineEventCount: number;
  /** From the post-session eval flywheel (loadSessionEvalResult) — null when eval hasn't run yet for this session (Redis miss or too recent). */
  qualityFlag: {
    overall: number;
    anomaly: boolean;
    issueKinds: ExtractedLearning["kind"][];
  } | null;
};

type DenisDebugSessionQueryRow = {
  id: string;
  table_id: string;
  status: string;
  language: string;
  created_at: string;
  tables: { name: string } | { name: string }[] | null;
};

function parseDenisDebugSessionRows(data: unknown): DenisDebugSessionQueryRow[] {
  if (!Array.isArray(data)) return [];
  return data as DenisDebugSessionQueryRow[];
}

function tableNameFromRelation(
  tables: { name: string } | { name: string }[] | null
): string | null {
  if (!tables) return null;
  if (Array.isArray(tables)) return tables[0]?.name ?? null;
  return tables.name;
}

export async function listDenisDebugSessions(
  admin: SupabaseClient,
  locationId: string,
  limit = 40
): Promise<DenisDebugSessionRow[]> {
  const { data: sessions, error } = await admin
    .from("ai_sessions")
    .select("id, table_id, status, language, created_at, tables(name)")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !sessions?.length) {
    return [];
  }

  const rows = parseDenisDebugSessionRows(sessions);
  const sessionIds = rows.map((row) => row.id);
  const countBySession = new Map<string, number>();

  const { data: timelineRows } = await admin
    .from("denis_timeline")
    .select("ai_session_id")
    .in("ai_session_id", sessionIds);

  for (const row of (timelineRows ?? []) as Array<{ ai_session_id: string }>) {
    countBySession.set(
      row.ai_session_id,
      (countBySession.get(row.ai_session_id) ?? 0) + 1
    );
  }

  const evalResults = await Promise.all(
    sessionIds.map((id) => loadSessionEvalResult(id))
  );
  const evalBySession = new Map(
    sessionIds.map((id, index) => [id, evalResults[index]])
  );

  const withQuality = rows.map((session) => {
    const evalResult = evalBySession.get(session.id) ?? null;
    return {
      id: session.id,
      tableId: session.table_id,
      tableName: tableNameFromRelation(session.tables),
      status: session.status,
      language: session.language,
      createdAt: session.created_at,
      timelineEventCount: countBySession.get(session.id) ?? 0,
      qualityFlag: evalResult
        ? {
            overall: evalResult.scores.overall,
            anomaly: evalResult.anomaly,
            issueKinds: [
              ...new Set(
                evalResult.learnings
                  .map((learning) => learning.kind)
                  .filter((kind) => kind !== "reinforcement")
              ),
            ],
          }
        : null,
    };
  });

  // Flagged sessions (anomaly or a real learning kind extracted) float to
  // the top so staff can jump straight to what needs a look, instead of
  // reading every session in chronological order to find the bad ones.
  const isFlagged = (row: (typeof withQuality)[number]) =>
    Boolean(row.qualityFlag?.anomaly || (row.qualityFlag?.issueKinds.length ?? 0) > 0);

  return [...withQuality].sort((a, b) => {
    const flagDelta = Number(isFlagged(b)) - Number(isFlagged(a));
    if (flagDelta !== 0) return flagDelta;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function loadDenisSessionDebugGraph(
  admin: SupabaseClient,
  input: { sessionId: string; locationId: string }
): Promise<DenisSessionDebugGraph | null> {
  const { data: session, error } = await admin
    .from("ai_sessions")
    .select("id, location_id")
    .eq("id", input.sessionId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  const events = await loadDenisTimeline(admin, input.sessionId);
  return buildSessionDebugGraph(events);
}

async function loadSessionTurnTraces(
  admin: SupabaseClient,
  sessionId: string
): Promise<TurnTrace[]> {
  const { data } = await admin
    .from("denis_turn_traces")
    .select("trace_data")
    .eq("ai_session_id", sessionId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as Array<{ trace_data: TurnTrace }>).map(
    (row) => row.trace_data
  );
}

export async function loadDenisSessionReplay(
  admin: SupabaseClient,
  input: { sessionId: string; locationId: string }
): Promise<(DenisSessionReplay & { graph: DenisSessionDebugGraph }) | null> {
  const { data: session, error } = await admin
    .from("ai_sessions")
    .select("id, location_id")
    .eq("id", input.sessionId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  const [events, traces] = await Promise.all([
    loadDenisTimeline(admin, input.sessionId),
    loadSessionTurnTraces(admin, input.sessionId),
  ]);

  return {
    graph: buildSessionDebugGraph(events),
    ...buildDenisSessionReplay({ events, traces }),
  };
}

export async function loadDenisInsightsAggregate(
  admin: SupabaseClient,
  locationId: string,
  periodDays = 14
): Promise<DenisInsightsAggregate | null> {
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  const { data: sessions } = await admin
    .from("ai_sessions")
    .select("id, created_at")
    .eq("location_id", locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  const sessionRows = (sessions ?? []) as Array<{ id: string; created_at: string }>;
  if (!sessionRows.length) {
    return buildDenisInsightsAggregate({
      events: [],
      sessionCount: 0,
      sessionQualities: [],
      edgeCases: [],
    });
  }

  const sessionIds = sessionRows.map((row) => row.id);
  const { data: timelineRows } = await admin
    .from("denis_timeline")
    .select(
      "id, ai_session_id, seq, event_type, payload, trace_id, context_hash, created_at"
    )
    .in("ai_session_id", sessionIds)
    .order("seq", { ascending: true });

  const events = (timelineRows ?? []) as Awaited<
    ReturnType<typeof loadDenisTimeline>
  >;

  const sessionQualities: Array<{
    createdAt: string;
    quality: ReturnType<typeof computeSessionConversationQuality>;
  }> = [];
  const edgeCases = [];

  for (const session of sessionRows.slice(0, 30)) {
    const sessionEvents = events.filter(
      (event) => event.ai_session_id === session.id
    );
    const traces = await loadSessionTurnTraces(admin, session.id);
    const quality = computeSessionConversationQuality({
      events: sessionEvents,
      traces,
    });
    sessionQualities.push({ createdAt: session.created_at, quality });
    edgeCases.push(
      ...collectUnknownIntentEdgeCases({
        sessionId: session.id,
        events: sessionEvents,
      })
    );
  }

  return buildDenisInsightsAggregate({
    events,
    sessionCount: sessionRows.length,
    sessionQualities,
    edgeCases: edgeCases.slice(0, 50),
  });
}
