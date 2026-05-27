import { buildSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import type { DenisSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisDebugSessionRow = {
  id: string;
  tableId: string;
  tableName: string | null;
  status: string;
  language: string;
  createdAt: string;
  timelineEventCount: number;
};

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

  const rows = sessions as Array<{
    id: string;
    table_id: string;
    status: string;
    language: string;
    created_at: string;
    tables: { name: string } | null;
  }>;

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

  return rows.map((session) => ({
    id: session.id,
    tableId: session.table_id,
    tableName: session.tables?.name ?? null,
    status: session.status,
    language: session.language,
    createdAt: session.created_at,
    timelineEventCount: countBySession.get(session.id) ?? 0,
  }));
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
