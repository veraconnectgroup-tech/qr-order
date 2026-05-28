import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  buildTurnEnvelope,
  type GuestIntent,
  type PerceptionChannel,
  type TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NarrationTier } from "@/lib/denis/runtime/narrate/narration-facts.schema";

export type PersistDenisTurnTimelineInput = {
  aiSessionId: string;
  locationId: string;
  traceId: string;
  guestMessage: string;
  assistantMessage: string;
  intent: GuestIntent;
  intentTier: "T0" | "T2";
  narrationTier?: NarrationTier;
  reflexTurn: ReflexTurnResult;
  channel?: PerceptionChannel;
  timelineSurface?: TurnEnvelope["surface"];
};

/** Append PPAN timeline events from a completed turn (M7). */
export async function persistDenisTurnTimeline(
  admin: SupabaseClient,
  input: PersistDenisTurnTimelineInput
): Promise<void> {
  const envelope = buildTurnEnvelope(
    input.timelineSurface ?? "chat",
    input.traceId
  );
  const plan = input.reflexTurn.plan;

  try {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "signal.message",
      traceId: input.traceId,
      payload: {
        type: "signal.message",
        text: input.guestMessage,
        channel: input.channel ?? "chat.message",
        intent: input.intent,
        envelope,
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "perception.ingested",
      traceId: input.traceId,
      payload: {
        type: "perception.ingested",
        envelope,
        frame: {
          channel: input.channel ?? "chat.message",
          normalizedText: input.guestMessage,
          structuredIntent: input.intent,
          ingestedAt: new Date().toISOString(),
        },
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "intent.resolved",
      traceId: input.traceId,
      payload: {
        type: "intent.resolved",
        intent: input.intent,
        tier: input.intentTier,
        evidence: input.reflexTurn.reflex?.evidence ?? null,
        envelope,
      },
    });

    if (input.reflexTurn.correction?.ok) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: input.aiSessionId,
        eventType: "draft.changed",
        traceId: input.traceId,
        payload: {
          type: "draft.changed",
          cartRevision: input.reflexTurn.cartState.draft.cartRevision,
          diff: input.reflexTurn.correction.diff,
          guestMessage: input.reflexTurn.correction.guestMessage,
        },
      });
    }

    if (input.reflexTurn.conflict?.hasConflict) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: input.aiSessionId,
        eventType: "belief.revision",
        traceId: input.traceId,
        payload: {
          type: "belief.revision",
          keys: ["cart.conflict"],
          conflicts: input.reflexTurn.conflict.conflicts.map((c) => c.kind),
          strategy: input.reflexTurn.conflict.strategy,
          guestPrompt: input.reflexTurn.conflict.guestPrompt,
        },
      });
    }

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "flow.transitioned",
      traceId: input.traceId,
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
      traceId: input.traceId,
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
      eventType: "tell.committed",
      traceId: input.traceId,
      payload: {
        type: "tell.committed",
        message: input.assistantMessage,
        tier:
          input.narrationTier ??
          (input.intentTier === "T0" ? "template" : "T3"),
        source: "turn.narrate",
        linted: input.narrationTier !== undefined,
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "narration.sent",
      traceId: input.traceId,
      payload: {
        type: "narration.sent",
        message: input.assistantMessage,
        tier:
          input.narrationTier ??
          (input.intentTier === "T0" ? "template" : "T3"),
        linted: input.narrationTier !== undefined,
      },
    });
  } catch (error) {
    logger.warn("persistDenisTurnTimeline failed", {
      aiSessionId: input.aiSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
