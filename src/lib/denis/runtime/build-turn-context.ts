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
import {
  loadTableParty,
  mergePeerManualDraft,
  registerPartyDevice,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
} from "@/lib/denis/venue/party";
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
  let party = null;
  let peerManualCartDraft = undefined;
  let draftAiSessionId = input.sessionId;

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: input.sessionToken,
  });

  if (tableSessionId && input.deviceFingerprint) {
    await registerPartyDevice(admin, {
      tableSessionId,
      locationId: input.locationId,
      tableId: input.tableId,
      deviceFingerprint: input.deviceFingerprint,
      aiSessionId: input.sessionId ?? null,
      manualCartSnapshot: input.manualCartSnapshot ?? null,
      manualCartRevision: input.manualCartSnapshot?.revision ?? 0,
    });

    party = await loadTableParty(admin, {
      tableSessionId,
      partyMode: config.party.mode,
      deviceFingerprint: input.deviceFingerprint,
    });

    if (party) {
      peerManualCartDraft = mergePeerManualDraft(
        party.devices,
        input.deviceFingerprint
      );
      draftAiSessionId = resolveDraftAiSessionId(
        config.party.mode,
        input.sessionId,
        party.sharedAiSessionId
      );
    }
  }

  if (draftAiSessionId) {
    const events = await loadDenisTimeline(admin, draftAiSessionId);
    flowNodeId = foldFlowProjection(events, "welcome").currentNodeId;

    const { data } = await admin
      .from("ai_sessions")
      .select("order_draft")
      .eq("id", draftAiSessionId)
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
    draftAiSessionId,
    config,
    flowNodeId,
    aiCartState,
    manualCartDraft: manualSnapshotToDenisDraft(input.manualCartSnapshot),
    peerManualCartDraft,
    party,
    foodUpsellAsked,
  };
}
