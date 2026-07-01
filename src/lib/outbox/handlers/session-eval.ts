import { runPostSessionEval } from "@/lib/denis/eval/continuous-eval-loop";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type SessionEvalPayload = {
  sessionId?: string;
  tableSessionId?: string;
  locationId?: string;
  aiSessionId?: string | null;
  ordersCount?: number;
  upsellOffered?: boolean;
  upsellAccepted?: boolean;
};

async function loadSessionTimeline(
  admin: ReturnType<typeof createAdminClient>,
  aiSessionId: string
): Promise<DenisTimelineRow[]> {
  const { data, error } = await admin
    .from("denis_timeline")
    .select("*")
    .eq("ai_session_id", aiSessionId)
    .order("seq", { ascending: true });

  if (error) {
    throw new Error(`denis_timeline load failed: ${error.message}`);
  }

  return (data ?? []) as DenisTimelineRow[];
}

async function resolveAiSessionId(
  admin: ReturnType<typeof createAdminClient>,
  payload: SessionEvalPayload
): Promise<{
  tableSessionId: string;
  locationId: string;
  aiSessionId: string | null;
}> {
  const tableSessionId = payload.tableSessionId ?? payload.sessionId;
  if (!tableSessionId) {
    throw new Error("session.eval missing tableSessionId");
  }

  if (payload.locationId && payload.aiSessionId !== undefined) {
    return {
      tableSessionId,
      locationId: payload.locationId,
      aiSessionId: payload.aiSessionId ?? null,
    };
  }

  const { data, error } = await admin
    .from("table_sessions")
    .select("id, location_id, denis_shared_ai_session_id")
    .eq("id", tableSessionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("session.eval table session not found");
  }

  const row = data as {
    id: string;
    location_id: string;
    denis_shared_ai_session_id: string | null;
  };

  return {
    tableSessionId: row.id,
    locationId: payload.locationId ?? row.location_id,
    aiSessionId: payload.aiSessionId ?? row.denis_shared_ai_session_id,
  };
}

/** Outbox handler — post-session auto-eval (continuous improvement loop). */
export async function handleSessionEval(
  payload: Record<string, unknown>
): Promise<void> {
  const parsed = payload as SessionEvalPayload;
  const admin = createAdminClient();

  const session = await resolveAiSessionId(admin, parsed);
  let timeline: DenisTimelineRow[] = [];

  if (session.aiSessionId) {
    timeline = await loadSessionTimeline(admin, session.aiSessionId);
  }

  const result = await runPostSessionEval({
    sessionId: session.tableSessionId,
    locationId: session.locationId,
    aiSessionId: session.aiSessionId,
    timeline,
    metrics: {
      ordersCount: parsed.ordersCount,
      upsellOffered: parsed.upsellOffered,
      upsellAccepted: parsed.upsellAccepted,
    },
  });

  logger.info("Denis post-session eval completed", {
    sessionId: result.sessionId,
    overall: result.scores.overall,
    anomaly: result.anomaly,
    learningCount: result.learnings.length,
    failureKinds: result.learnings
      .filter((row) => row.kind !== "reinforcement")
      .map((row) => row.kind),
  });
}
