import type { SupabaseClient } from "@supabase/supabase-js";
import type { DenisSessionUpdateReason } from "@/lib/integrations/webhooks/denis-session-updated.schema";
import {
  countUserMessages,
  extractIntentsFromTimeline,
  resolveSessionOutcome,
} from "@/lib/operator/projections/helpers";
import { enqueueDenisOperatorWebhooks } from "@/lib/webhooks/enqueue-denis-operator-webhook";
import { orgIdForLocation } from "@/lib/webhooks/org-context";
import { getCurrentTraceId } from "@/lib/resilience/trace-context";
import { logger } from "@/lib/logger";

export async function emitDenisSessionUpdated(
  admin: SupabaseClient,
  input: {
    tableSessionId: string;
    updateReason: DenisSessionUpdateReason;
    traceId?: string;
    viewVersion?: number;
  }
): Promise<void> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("id, location_id, status, denis_shared_ai_session_id")
    .eq("id", input.tableSessionId)
    .maybeSingle();

  if (!sessionRow) return;

  const session = sessionRow as {
    id: string;
    location_id: string;
    status: string;
    denis_shared_ai_session_id: string | null;
  };

  const orgId = await orgIdForLocation(session.location_id);
  if (!orgId) return;

  const { count: ordersCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .neq("status", "cancelled");

  let turnCount = 0;
  let timelineEvents: Array<{ event_type: string; payload: unknown }> = [];

  if (session.denis_shared_ai_session_id) {
    const { data: aiRow } = await admin
      .from("ai_sessions")
      .select("messages")
      .eq("id", session.denis_shared_ai_session_id)
      .maybeSingle();

    if (aiRow) {
      const ai = aiRow as {
        messages: Array<{ role: string; content: string }>;
      };
      turnCount = countUserMessages(ai.messages ?? []);
    }

    const { data: timelineRows } = await admin
      .from("denis_timeline")
      .select("event_type, payload")
      .eq("ai_session_id", session.denis_shared_ai_session_id);
    timelineEvents = (timelineRows ?? []) as typeof timelineEvents;
  }

  const handoffCount = timelineEvents.filter((event) => {
    if (event.event_type !== "intent.resolved") return false;
    const payload = event.payload as { intent?: string } | null;
    return (
      payload?.intent === "HANDOFF_WAITER" || payload?.intent === "HANDOFF_PAY"
    );
  }).length;

  const outcome = resolveSessionOutcome({
    status: session.status,
    ordersCount: ordersCount ?? 0,
    handoffCount,
  });

  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId,
      event: "denis.session.updated",
      aggregateId: session.id,
      payload: {
        orgId,
        locationId: session.location_id,
        sessionId: session.id,
        outcome,
        metrics: {
          updateReason: input.updateReason,
          status: session.status,
          outcome,
          ordersCount: ordersCount ?? 0,
          turnCount,
          intents: extractIntentsFromTimeline(timelineEvents),
          viewVersion: input.viewVersion,
        },
        traceId: input.traceId ?? getCurrentTraceId(),
      },
    });
  } catch (error) {
    logger.warn("denis.session.updated enqueue failed", {
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisSessionCompleted(
  admin: SupabaseClient,
  input: {
    tableSessionId: string;
    traceId?: string;
  }
): Promise<void> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("id, location_id, status, denis_shared_ai_session_id")
    .eq("id", input.tableSessionId)
    .maybeSingle();

  if (!sessionRow) return;

  const session = sessionRow as {
    id: string;
    location_id: string;
    status: string;
    denis_shared_ai_session_id: string | null;
  };

  const orgId = await orgIdForLocation(session.location_id);
  if (!orgId) return;

  const { count: ordersCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .neq("status", "cancelled");

  let handoffCount = 0;
  if (session.denis_shared_ai_session_id) {
    const { data: timelineRows } = await admin
      .from("denis_timeline")
      .select("event_type, payload")
      .eq("ai_session_id", session.denis_shared_ai_session_id);
    handoffCount = (timelineRows ?? []).filter((event) => {
      const row = event as { event_type: string; payload: unknown };
      if (row.event_type !== "intent.resolved") return false;
      const payload = row.payload as { intent?: string } | null;
      return (
        payload?.intent === "HANDOFF_WAITER" || payload?.intent === "HANDOFF_PAY"
      );
    }).length;
  }

  const outcome = resolveSessionOutcome({
    status: session.status,
    ordersCount: ordersCount ?? 0,
    handoffCount,
  });

  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId,
      event: "denis.session.completed",
      aggregateId: session.id,
      payload: {
        orgId,
        locationId: session.location_id,
        sessionId: session.id,
        outcome,
        traceId: input.traceId ?? getCurrentTraceId(),
      },
    });
  } catch (error) {
    logger.warn("denis.session.completed enqueue failed", {
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisSessionConverted(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    orderId: string;
    traceId?: string;
  }
): Promise<void> {
  const { data: aiRow } = await admin
    .from("ai_sessions")
    .select("id, org_id, location_id, linked_order_ids")
    .eq("id", input.aiSessionId)
    .maybeSingle();

  if (!aiRow) return;

  const ai = aiRow as {
    id: string;
    org_id: string;
    location_id: string;
    linked_order_ids: string[];
  };

  const priorOrders = (ai.linked_order_ids ?? []).filter(
    (id) => id !== input.orderId
  );
  if (priorOrders.length > 0) return;

  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("denis_shared_ai_session_id", ai.id)
    .maybeSingle();

  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: ai.org_id,
      event: "denis.session.converted",
      aggregateId: ai.id,
      payload: {
        orgId: ai.org_id,
        locationId: ai.location_id,
        sessionId: (tableSession as { id: string } | null)?.id,
        metrics: { orderId: input.orderId },
        traceId: input.traceId ?? getCurrentTraceId(),
      },
    });
  } catch (error) {
    logger.warn("denis.session.converted enqueue failed", {
      aiSessionId: ai.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
