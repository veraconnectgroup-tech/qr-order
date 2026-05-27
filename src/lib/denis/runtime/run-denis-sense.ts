import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  aiOrderDraftToDenisCartState,
  manualSnapshotToDenisDraft,
} from "@/lib/denis/runtime/adapters/map-legacy-draft";
import { mapGuestOrdersToSchedulerSnapshot } from "@/lib/denis/runtime/adapters/map-scheduler-orders";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  buildScheduleDrafts,
  upsertDenisSchedules,
} from "@/lib/denis/kernel/scheduler";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  buildTurnEnvelope,
  createTurnTraceId,
} from "@/lib/denis/platform/timeline-types";
import type { DenisSenseRequest } from "@/lib/denis/platform/sense-types";
import {
  evaluateGuestProactiveTick,
  type GuestProactiveNudge,
  type ProactiveTickPayload,
} from "@/lib/denis/runtime/evaluate-proactive-tick";
import { resolveTurnQuickReplies } from "@/lib/denis/runtime/narrate/build-turn-quick-replies";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate/build-narration-facts";
import {
  loadTableParty,
  mergePeerManualDraft,
  registerPartyDevice,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
} from "@/lib/denis/venue/party";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";

export type DenisSenseResult = {
  traceId: string;
  aiSessionId: string | null;
  schedulesUpserted: number;
  conflictPrompt: string | null;
  ingested: boolean;
  proactiveNudge?: GuestProactiveNudge | null;
  quickReplies?: string[];
  partyMode?: string;
  partyDeviceCount?: number;
  isPrimaryDevice?: boolean;
  sharedAiSessionId?: string | null;
};

/** Ingest sensory event without chat — timeline + optional schedules (M8). */
export async function runDenisSense(
  input: DenisSenseRequest
): Promise<Response> {
  const admin = createAdminClient();
  const traceId = createTurnTraceId();
  const envelope = buildTurnEnvelope("sense", traceId);

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
  });

  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const aiSessionId = input.aiSessionId ?? null;
  const config = await loadConciergeConfigForLocation(input.locationId);
  let draftAiSessionId = aiSessionId;
  let aiCartState = emptyCartState();
  let schedulesUpserted = 0;
  let conflictPrompt: string | null = null;
  let proactiveNudge: GuestProactiveNudge | null = null;
  let quickReplies: string[] | undefined;
  let partyDeviceCount = 0;
  let isPrimaryDevice = false;
  let sharedAiSessionId: string | null = null;
  let peerManualCartDraft = undefined;

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
      aiSessionId,
      manualCartSnapshot: input.manualCartSnapshot ?? null,
      manualCartRevision: input.manualCartSnapshot?.revision ?? 0,
    });

    const party = await loadTableParty(admin, {
      tableSessionId,
      partyMode: config.party.mode,
      deviceFingerprint: input.deviceFingerprint,
    });

    if (party) {
      partyDeviceCount = party.activeDeviceCount;
      isPrimaryDevice = party.isCurrentDevicePrimary;
      sharedAiSessionId = party.sharedAiSessionId;
      peerManualCartDraft = mergePeerManualDraft(
        party.devices,
        input.deviceFingerprint
      );
      draftAiSessionId =
        resolveDraftAiSessionId(
          config.party.mode,
          aiSessionId ?? undefined,
          party.sharedAiSessionId
        ) ?? aiSessionId;
    }
  }

  if (draftAiSessionId) {
    const { data: sessionRow } = await admin
      .from("ai_sessions")
      .select("id, order_draft, location_id, table_id")
      .eq("id", draftAiSessionId)
      .maybeSingle();

    const row = sessionRow as {
      id: string;
      order_draft: unknown;
      location_id: string;
      table_id: string;
    } | null;

    if (
      !row ||
      row.location_id !== input.locationId ||
      row.table_id !== input.tableId
    ) {
      if (aiSessionId === draftAiSessionId) {
        return apiError("Session not found.", 404);
      }
    } else {
      aiCartState = aiOrderDraftToDenisCartState(
        initDraftFromStorage(row.order_draft)
      );
    }
  }

  if (aiSessionId) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId,
      eventType: "realtime.ingested",
      traceId,
      payload: {
        type: "realtime.ingested",
        source: input.channel,
        payload: input.payload,
        envelope,
      },
    });

    await appendDenisTimelineEvent(admin, {
      aiSessionId,
      eventType: "perception.ingested",
      traceId,
      payload: {
        type: "perception.ingested",
        envelope,
        frame: {
          channel: input.channel,
          normalizedText: null,
          structuredIntent: null,
          ingestedAt: new Date().toISOString(),
        },
      },
    });
  }

  if (
    draftAiSessionId &&
    input.channel === "telemetry.manual_cart" &&
    input.manualCartSnapshot
  ) {
    const reflexTurn = planTurnWithReflex({
      config,
      message: "",
      flowNodeId: "recap",
      cartState: aiCartState,
      manualCartDraft: manualSnapshotToDenisDraft(input.manualCartSnapshot),
      peerManualCartDraft,
    });
    conflictPrompt = reflexTurn.conflict?.guestPrompt ?? null;
    if (conflictPrompt) {
      const facts = buildNarrationFacts({
        config,
        language: config.language.venueDefault,
        reflexTurn,
      });
      quickReplies = resolveTurnQuickReplies({
        reflexTurn,
        facts,
        narration: {
          message: conflictPrompt,
          tier: "template",
          lintPassed: true,
          issues: [],
          usedFallback: true,
        },
        language: config.language.venueDefault,
      });
    }

    if (reflexTurn.conflict?.hasConflict) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId,
        eventType: "belief.revision",
        traceId,
        payload: {
          type: "belief.revision",
          keys: ["cart.conflict"],
          channel: input.channel,
          guestPrompt: conflictPrompt,
        },
      });
    }
  }

  const guestOrders = await loadGuestOrdersForAi(
    admin,
    input.tableId,
    input.sessionToken
  );

  if (
    aiSessionId &&
    (input.channel === "realtime.order_status" ||
      input.channel === "system.proactive_tick")
  ) {
    const orders = mapGuestOrdersToSchedulerSnapshot(guestOrders);
    const drafts = buildScheduleDrafts({ orders, config });
    schedulesUpserted = await upsertDenisSchedules(
      admin,
      aiSessionId,
      input.locationId,
      drafts
    );
  }

  if (input.channel === "system.proactive_tick") {
    const payload = (input.payload ?? {}) as ProactiveTickPayload & {
      browseMessage?: string;
      dessertMessage?: string;
      slowKitchenMessage?: string;
    };
    proactiveNudge = evaluateGuestProactiveTick({
      config,
      orders: guestOrders,
      payload,
      messages: {
        browse: payload.browseMessage ?? "Treba vam pomoć pri biranju?",
        dessert: payload.dessertMessage ?? "Spremni za desert?",
        slowKitchen:
          payload.slowKitchenMessage ??
          "Kuhinja radi intenzivno — želite nešto da popijete dok čekate?",
      },
    });
  }

  return apiSuccess({
    traceId,
    aiSessionId,
    schedulesUpserted,
    conflictPrompt,
    ingested: aiSessionId !== null,
    proactiveNudge,
    quickReplies,
    partyMode: config.party.mode,
    partyDeviceCount,
    isPrimaryDevice,
    sharedAiSessionId,
  } satisfies DenisSenseResult);
}
