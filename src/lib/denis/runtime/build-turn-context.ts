import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import {
  aiOrderDraftToDenisCartState,
  manualSnapshotToDenisDraft,
} from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type {
  DenisChatBody,
  DenisTurnContext,
} from "@/lib/denis/runtime/turn-types";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionDraftRow = {
  order_draft: unknown;
};

/** Load Denis planning context before legacy narrate (M7). */
export async function buildDenisTurnContext(
  admin: SupabaseClient,
  input: DenisChatBody
): Promise<DenisTurnContext> {
  const config = await loadConciergeConfigForLocation(input.locationId);
  let flowNodeId: FlowNodeId = "welcome";
  let aiCartState = emptyCartState();
  let foodUpsellAsked = false;

  if (input.sessionId) {
    const events = await loadDenisTimeline(admin, input.sessionId);
    flowNodeId = foldFlowProjection(events, "welcome").currentNodeId;

    const { data } = await admin
      .from("ai_sessions")
      .select("order_draft")
      .eq("id", input.sessionId)
      .maybeSingle();

    const draft = initDraftFromStorage(
      (data as SessionDraftRow | null)?.order_draft ?? null
    );
    aiCartState = aiOrderDraftToDenisCartState(draft);
    foodUpsellAsked = draft.flow?.foodUpsellAsked ?? false;
  }

  return {
    locationId: input.locationId,
    aiSessionId: input.sessionId,
    config,
    flowNodeId,
    aiCartState,
    manualCartDraft: manualSnapshotToDenisDraft(input.manualCartSnapshot),
    foodUpsellAsked,
  };
}
