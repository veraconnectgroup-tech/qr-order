import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import type { FoldResult } from "@/lib/denis/loop/types";

/** Map folded Mind state into legacy DenisTurnContext (Phase A bridge). */
export function mapFoldToTurnContext(
  fold: FoldResult,
  input: {
    locationId: string;
    aiSessionId?: string;
  }
): DenisTurnContext {
  const { state, meta } = fold;

  return {
    locationId: input.locationId,
    aiSessionId: input.aiSessionId,
    draftAiSessionId: meta.draftAiSessionId ?? undefined,
    config: state.config,
    flowNodeId: state.conversation.flowNodeId,
    aiCartState: state.commerce.cart.ai,
    manualCartDraft: state.commerce.cart.manual,
    peerManualCartDraft: state.commerce.cart.peerManual,
    party: state.party,
    venueOps: state.venue.ops,
    opsEffects: state.venue.opsEffects,
    foodUpsellAsked: state.conversation.foodUpsellAsked,
    guestMemory: state.guest,
    lastAssistantMessage: state.conversation.lastAssistantMessage,
    foldMeta: meta,
    tableSessionState: state,
  };
}
