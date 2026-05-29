import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { pendingSlotKindFromDraft } from "@/lib/ai/ordering/pending-slot-kind";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildFoldMeta } from "@/lib/denis/loop/compute-truth-hash";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import { extractDismissedNudges, extractProactiveDedupeKeys } from "@/lib/denis/loop/extract-dismissed-nudges";
import { loadOrderFactsForSession } from "@/lib/denis/loop/load-order-facts";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { lastTellFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { FoldInput, FoldResult, TableSessionState } from "@/lib/denis/loop/types";
import {
  aiOrderDraftToDenisCartState,
  manualSnapshotToDenisDraft,
} from "@/lib/denis/loop/adapters/map-cart-snapshot";
import { mergePeerManualDraft } from "@/lib/denis/loop/adapters/merge-peer-manual";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import { loadEffectiveVenueOps } from "@/lib/denis/venue/ops";
import {
  loadTableParty,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
} from "@/lib/denis/venue/party";
import { loadGuestMemoryProjection } from "@/lib/guest/denis-guest-memory-store";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionDraftRow = {
  order_draft: unknown;
};

type TableSessionRow = {
  id: string;
  status: string;
  access_state: string | null;
  session_token: string;
  table: { name: string };
  location: { ai_concierge_enabled: boolean };
};

/**
 * Rebuild TableSessionState from TRUTH — timeline, orders, ops, party, cart (ADR-019 Phase A).
 */
export async function foldTableSessionState(
  admin: SupabaseClient,
  input: FoldInput
): Promise<FoldResult> {
  const config =
    input.config ?? (await loadConciergeConfigForLocation(input.locationId));

  const tableSessionId =
    input.tableSessionId ??
    (await resolveActiveTableSessionId(admin, {
      tableId: input.tableId,
      locationId: input.locationId,
      sessionToken: input.sessionToken,
    }));

  let party = input.party ?? null;
  if (!party && tableSessionId && input.deviceFingerprint) {
    party = await loadTableParty(admin, {
      tableSessionId,
      partyMode: config.party.mode,
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  const draftAiSessionId =
    input.draftAiSessionId ??
    resolveDraftAiSessionId(
      config.party.mode,
      input.aiSessionId,
      party?.sharedAiSessionId ?? null
    ) ??
    input.aiSessionId ??
    null;

  const peerManualCartDraft =
    party && input.deviceFingerprint
      ? mergePeerManualDraft(party.devices, input.deviceFingerprint)
      : undefined;

  const manualCartDraft = manualSnapshotToDenisDraft(input.manualCartSnapshot);

  const [venueBundle, timeline, sessionRow, commerceState, tableSessionRow, aiSessions] =
    await Promise.all([
      loadEffectiveVenueOps(admin, {
        locationId: input.locationId,
        tableId: input.tableId,
        config,
      }),
      draftAiSessionId
        ? loadDenisTimeline(admin, draftAiSessionId)
        : Promise.resolve([]),
      draftAiSessionId
        ? admin
            .from("ai_sessions")
            .select("order_draft")
            .eq("id", draftAiSessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      tableSessionId
        ? admin
            .from("guest_session_commerce_state" as never)
            .select("bill_settled, feedback_submitted")
            .eq("session_id", tableSessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      tableSessionId
        ? admin
            .from("table_sessions")
            .select(
              `
              id,
              status,
              access_state,
              session_token,
              table:tables!inner(name),
              location:locations!inner(ai_concierge_enabled)
            `
            )
            .eq("id", tableSessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      tableSessionId
        ? admin
            .from("table_sessions")
            .select("session_token, table_id")
            .eq("id", tableSessionId)
            .maybeSingle()
            .then(async ({ data }) => {
              const row = data as {
                session_token: string;
                table_id: string;
              } | null;
              if (!row) return [];
              const { data: sessions } = await admin
                .from("ai_sessions")
                .select("id")
                .eq("session_token", row.session_token)
                .eq("table_id", row.table_id)
                .eq("status", "active")
                .limit(1);
              return sessions ?? [];
            })
        : Promise.resolve([]),
    ]);

  const orders = tableSessionId
    ? await loadOrderFactsForSession(admin, tableSessionId)
    : [];

  const draftRow = sessionRow.data as SessionDraftRow | null;
  const draft = initDraftFromStorage(draftRow?.order_draft ?? null);
  const aiCartState = draftAiSessionId
    ? aiOrderDraftToDenisCartState(draft)
    : emptyCartState();

  const flowNodeId = foldFlowProjection(timeline, "welcome").currentNodeId;
  const foodUpsellAsked = draft.flow?.foodUpsellAsked ?? false;
  const lastAssistantMessage = lastTellFromTimeline(timeline);
  const dismissedNudges = [
    ...new Set([
      ...extractDismissedNudges(timeline),
      ...extractProactiveDedupeKeys(timeline),
    ]),
  ];

  let guestMemory = null;
  if (config.memory.returnGuestEnabled && input.deviceFingerprint) {
    guestMemory = await loadGuestMemoryProjection(admin, {
      locationId: input.locationId,
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  const tableSession = tableSessionRow.data as TableSessionRow | null;
  const commerce = commerceState.data as {
    bill_settled?: boolean;
    feedback_submitted?: boolean;
  } | null;
  const denisEnabled = Boolean(tableSession?.location.ai_concierge_enabled);
  const denisActive = denisEnabled && aiSessions.length > 0;

  const hasCartActivity =
    aiCartState.draft.items.length > 0 ||
    Boolean(manualCartDraft?.items.length) ||
    Boolean(peerManualCartDraft?.items.length);

  const phase = deriveFoldSessionPhase({
    sessionStatus: tableSession?.status ?? "active",
    accessState: tableSession?.access_state ?? null,
    orders,
    hasCartActivity,
    billSettled: Boolean(commerce?.bill_settled),
  });

  const state: TableSessionState = {
    table: {
      id: input.tableId,
      name: tableSession?.table.name ?? "",
      token: input.sessionToken,
    },
    session: {
      id: tableSessionId ?? "",
      status: tableSession?.status ?? "active",
      accessState: tableSession?.access_state ?? null,
      billSettled: Boolean(commerce?.bill_settled),
      feedbackSubmitted: Boolean(commerce?.feedback_submitted),
      denisEnabled,
      denisActive,
    },
    commerce: {
      orders,
      cart: buildMergedCart({
        ai: aiCartState,
        manual: manualCartDraft,
        peerManual: peerManualCartDraft,
      }),
    },
    venue: {
      ops: venueBundle.venueOps,
      opsEffects: venueBundle.opsEffects,
    },
    party,
    guest: guestMemory,
    conversation: {
      flowNodeId,
      foodUpsellAsked,
      dismissedNudges,
      lastAssistantMessage,
      pendingSlot: pendingSlotKindFromDraft(draft),
    },
    timeline,
    config,
  };

  return {
    state,
    meta: buildFoldMeta(state, tableSessionId, draftAiSessionId, phase),
  };
}
