import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import {
  createTurnTraceId,
  type GuestIntent,
  type PerceptionChannel,
  type TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import {
  guestIntentTierFromReflex,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
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

/** @deprecated Prefer runDenisTurn — kept for transitional callers. */
export async function recordChatTurnTimeline(
  admin: SupabaseClient,
  input: RecordChatTurnTimelineInput
): Promise<string | null> {
  const traceId = input.traceId ?? createTurnTraceId();

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

    const intent = resolveTurnIntent(reflexTurn.reflex?.intent, input.intent);

    await persistDenisTurnTimeline(admin, {
      aiSessionId: input.aiSessionId,
      locationId: input.locationId ?? "",
      traceId,
      guestMessage: input.guestMessage,
      assistantMessage: input.assistantMessage,
      intent,
      intentTier:
        input.intentTier ?? guestIntentTierFromReflex(reflexTurn.usedT0),
      reflexTurn,
      channel: input.channel,
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
