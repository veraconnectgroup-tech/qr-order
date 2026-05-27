import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  buildTurnEnvelope,
  createTurnTraceId,
  type GuestIntent,
  type PerceptionChannel,
  type TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordChatTurnTimelineInput = {
  aiSessionId: string;
  locationId?: string;
  flowNodeId?: FlowNodeId;
  channel?: PerceptionChannel;
  guestMessage: string;
  assistantMessage: string;
  intent: GuestIntent;
  intentTier?: "T0" | "T2";
  traceId?: string;
  surface?: TurnEnvelope["surface"];
  cartItems?: Array<{ menuSection?: string | null }>;
};

/** Dual-write for legacy chat (M2+) with flow plan (M3) + T0 reflex (M4). */
export async function recordChatTurnTimeline(
  admin: SupabaseClient,
  input: RecordChatTurnTimelineInput
): Promise<string | null> {
  const traceId = input.traceId ?? createTurnTraceId();
  const envelope = buildTurnEnvelope(input.surface ?? "chat", traceId);

  try {
    const events = await loadDenisTimeline(admin, input.aiSessionId);
    const flowState = foldFlowProjection(events, "welcome");
    const currentNode = input.flowNodeId ?? flowState.currentNodeId;

    const config = input.locationId
      ? await loadConciergeConfigForLocation(input.locationId)
      : CONCIERGE_PLATFORM_DEFAULTS;

    const reflexTurn = planTurnWithReflex({
      config,
      message: input.guestMessage,
      flowNodeId: currentNode,
    });

    const resolvedIntent = (reflexTurn.reflex?.intent ??
      input.intent) as GuestIntent;
    const resolvedTier =
      input.intentTier ?? (reflexTurn.usedT0 ? "T0" : "T2");

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "perception.ingested",
      traceId,
      payload: {
        type: "perception.ingested",
        envelope,
        frame: {
          channel: input.channel ?? "chat.message",
          normalizedText: input.guestMessage,
          structuredIntent: resolvedIntent,
          ingestedAt: new Date().toISOString(),
        },
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "intent.resolved",
      traceId,
      payload: {
        type: "intent.resolved",
        intent: resolvedIntent,
        tier: resolvedTier,
        evidence: reflexTurn.reflex?.evidence ?? null,
        envelope,
      },
    });

    const plan = reflexTurn.plan;

    if (reflexTurn.correction?.ok) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: input.aiSessionId,
        eventType: "draft.changed",
        traceId,
        payload: {
          type: "draft.changed",
          cartRevision: reflexTurn.cartState.draft.cartRevision,
          diff: reflexTurn.correction.diff,
          guestMessage: reflexTurn.correction.guestMessage,
        },
      });
    }

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "flow.transitioned",
      traceId,
      payload: {
        from: plan.transition.fromNodeId,
        to: plan.transition.toNodeId,
        signal: plan.primarySignal,
        goals: plan.goals.map((g) => g.type),
        skills: plan.skills.map((s) => ({
          id: s.id,
          riskClass: s.riskClass,
        })),
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "plan.created",
      traceId,
      payload: {
        type: "plan.created",
        actions: plan.skills.map((s) => ({
          skillId: s.id,
          riskClass: s.riskClass,
        })),
        topGoal: plan.topGoal?.type ?? null,
        envelope,
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "narration.sent",
      traceId,
      payload: {
        type: "narration.sent",
        message: input.assistantMessage,
        tier: "T3",
      },
    });

    return traceId;
  } catch (error) {
    logger.warn("recordChatTurnTimeline failed", {
      aiSessionId: input.aiSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
