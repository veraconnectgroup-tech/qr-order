import {
  ingestBrowseTelemetry,
  parseBrowseEventFromPayload,
} from "@/lib/denis/cognition/browse";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { appendMindBeliefsCompiled } from "@/lib/denis/cognition/beliefs/append-mind-beliefs-compiled";
import type { ProactiveTurnMessages } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import { appendMindFoldCompleted } from "@/lib/denis/loop/append-fold-completed";
import { maybeAppendMentalModelUpdated } from "@/lib/denis/cognition/mental-model/append-mental-model-event";
import { maybeAppendOfferResolved } from "@/lib/denis/cognition/offer/append-offer-event";
import { maybeAppendOfferConverted } from "@/lib/denis/cognition/offer/append-offer-converted";
import { maybeAppendNudgeOutcomes } from "@/lib/denis/cognition/offer/append-nudge-outcome";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { emitProactiveNudge } from "@/lib/denis/runtime/emit-proactive-nudge";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import { manualSnapshotToDenisDraft } from "@/lib/denis/loop/adapters/map-cart-snapshot";
import { scheduleDenisAnticipationCommerceProjection } from "@/lib/denis/runtime/schedule-denis-anticipation-commerce";
import { scheduleNudgeOutcomeCommerceProjection } from "@/lib/denis/runtime/schedule-nudge-outcome-commerce";
import { mapGuestOrdersToSchedulerSnapshot } from "@/lib/denis/runtime/adapters/map-scheduler-orders";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  buildScheduleDrafts,
  upsertDenisSchedules,
} from "@/lib/denis/kernel/scheduler";
import { appendDenisTimelineEvent, loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import {
  buildTurnEnvelope,
  createTurnTraceId,
} from "@/lib/denis/platform/timeline-types";
import type { DenisSenseRequest } from "@/lib/denis/platform/sense-types";
import {
  type GuestProactiveNudge,
  type ProactiveTickPayload,
} from "@/lib/denis/runtime/evaluate-proactive-tick";
import { resolveTurnQuickReplies } from "@/lib/denis/runtime/narrate/build-turn-quick-replies";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate/build-narration-facts";
import {
  loadTableParty,
  registerPartyDevice,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
  resolveGuestTableSessionLookupToken,
} from "@/lib/denis/venue/party";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
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
  foldOrderCount?: number;
  foldPhase?: string;
};

function orderFactsToGuestOrders(
  orders: Array<{
    id: string;
    status: string;
    createdAt: string;
    items: Array<{ productName: string; quantity: number }>;
  }>
): AiGuestOrder[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.createdAt,
    delivered_at: order.status === "delivered" ? order.createdAt : null,
    order_items: order.items.map((item) => ({
      product_id: null,
      product_name: item.productName,
      unit_price: 0,
      quantity: item.quantity,
      menu_section: "food" as const,
    })),
  }));
}

/** Ingest sensory event without chat — timeline + optional schedules (M8 + ADR-019 A). */
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

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: resolveGuestTableSessionLookupToken({
      tableSessionToken: input.tableSessionToken,
      sessionToken: input.sessionToken,
    }),
  });

  let party = null;
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

    party = await loadTableParty(admin, {
      tableSessionId,
      partyMode: config.party.mode,
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  const draftAiSessionId =
    resolveDraftAiSessionId(
      config.party.mode,
      aiSessionId ?? undefined,
      party?.sharedAiSessionId ?? null
    ) ?? aiSessionId;

  const fold = await foldTableSessionState(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
    aiSessionId: aiSessionId ?? undefined,
    draftAiSessionId: draftAiSessionId ?? undefined,
    deviceFingerprint: input.deviceFingerprint,
    manualCartSnapshot: input.manualCartSnapshot,
    config,
    tableSessionId,
    party,
  });

  const { state } = fold;
  const timelineAiSessionId = draftAiSessionId ?? aiSessionId;
  const aiCartState = state.commerce.cart.ai;
  const peerManualCartDraft = state.commerce.cart.peerManual;
  const venueOps = state.venue.ops;
  const opsEffects = state.venue.opsEffects;
  const guestOrders = orderFactsToGuestOrders(state.commerce.orders);

  let schedulesUpserted = 0;
  let conflictPrompt: string | null = null;
  let proactiveNudge: GuestProactiveNudge | null = null;
  let quickReplies: string[] | undefined;

  if (draftAiSessionId) {
    await appendMindFoldCompleted(admin, {
      aiSessionId: draftAiSessionId,
      traceId,
      meta: fold.meta,
    });
    await maybeAppendMentalModelUpdated(admin, {
      aiSessionId: draftAiSessionId,
      traceId,
      timeline: state.timeline,
      mental: state.mental,
      contextHash: fold.meta.truthHash,
    });
    await maybeAppendOfferResolved(admin, {
      aiSessionId: draftAiSessionId,
      traceId,
      timeline: state.timeline,
      offer: state.offer,
      contextHash: fold.meta.truthHash,
    });
    const converted = await maybeAppendOfferConverted(admin, {
      aiSessionId: draftAiSessionId,
      traceId,
      timeline: state.timeline,
      contextHash: fold.meta.truthHash,
    });
    const nudgeOutcomes = await maybeAppendNudgeOutcomes(admin, {
      aiSessionId: draftAiSessionId,
      traceId,
      timeline: state.timeline,
      contextHash: fold.meta.truthHash,
    });
    if (nudgeOutcomes.length > 0) {
      scheduleNudgeOutcomeCommerceProjection(admin, {
        aiSessionId: draftAiSessionId,
        tableSessionId: fold.meta.tableSessionId ?? undefined,
        traceId,
        outcomes: nudgeOutcomes,
      });
    }
    if (converted.length > 0) {
      scheduleDenisAnticipationCommerceProjection(admin, {
        kind: "offer_converted",
        aiSessionId: draftAiSessionId,
        tableSessionId: fold.meta.tableSessionId ?? undefined,
        traceId,
        conversions: converted,
      });
    }
  }

  if (input.channel === "telemetry.browse") {
    const browseEvent = parseBrowseEventFromPayload(input.payload);
    if (!browseEvent) {
      return apiError("Invalid browse event.", 400);
    }
    if (timelineAiSessionId) {
      await ingestBrowseTelemetry(
        admin,
        timelineAiSessionId,
        browseEvent,
        traceId,
        envelope
      );
      const timelineAfterBrowse = await loadDenisTimeline(admin, timelineAiSessionId);
      const converted = await maybeAppendOfferConverted(admin, {
        aiSessionId: timelineAiSessionId,
        traceId,
        timeline: timelineAfterBrowse,
        contextHash: fold.meta.truthHash,
      });
      const nudgeOutcomes = await maybeAppendNudgeOutcomes(admin, {
        aiSessionId: timelineAiSessionId,
        traceId,
        timeline: timelineAfterBrowse,
        contextHash: fold.meta.truthHash,
      });
      if (nudgeOutcomes.length > 0) {
        scheduleNudgeOutcomeCommerceProjection(admin, {
          aiSessionId: timelineAiSessionId,
          tableSessionId: fold.meta.tableSessionId ?? undefined,
          traceId,
          outcomes: nudgeOutcomes,
        });
      }
      if (converted.length > 0) {
        scheduleDenisAnticipationCommerceProjection(admin, {
          kind: "offer_converted",
          aiSessionId: timelineAiSessionId,
          tableSessionId: fold.meta.tableSessionId ?? undefined,
          traceId,
          conversions: converted,
        });
      }
    }
  } else if (timelineAiSessionId) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: timelineAiSessionId,
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
      aiSessionId: timelineAiSessionId,
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
      flowNodeId: state.conversation.flowNodeId,
      cartState: aiCartState,
      manualCartDraft: manualSnapshotToDenisDraft(input.manualCartSnapshot),
      peerManualCartDraft,
      skipUpsell: opsEffects.skipUpsell,
    });
    conflictPrompt = reflexTurn.conflict?.guestPrompt ?? null;
    if (conflictPrompt) {
      const facts = buildNarrationFacts({
        config,
        language: config.language.venueDefault,
        reflexTurn,
        venueOps,
        opsEffects,
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

    if (reflexTurn.conflict?.hasConflict && aiSessionId) {
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

    if (draftAiSessionId) {
      await appendMindBeliefsCompiled(admin, {
        aiSessionId: draftAiSessionId,
        traceId,
        graph: compileBeliefs({ state, guestMessage: "" }),
        truthHash: fold.meta.truthHash,
      });
    }

    if (aiSessionId && tableSessionId) {
      proactiveNudge = await emitProactiveNudge(admin, {
        aiSessionId,
        tableSessionId,
        tableId: input.tableId,
        locationId: input.locationId,
        sessionToken: input.sessionToken,
        venueName: guestContext.data.orgName,
        config,
        state,
        orders: guestOrders,
        sessionPhase: deriveFoldSessionPhase({
          sessionStatus: state.session.status,
          accessState: state.session.accessState,
          orders: state.commerce.orders,
          hasCartActivity: state.commerce.cart.visibleLines.length > 0,
          billSettled: state.session.billSettled,
        }),
        source: "sense.proactive_brain",
        traceId,
        payload: {
          ...payload,
          dismissedNudgeKeys:
            payload.dismissedNudgeKeys ?? state.conversation.dismissedNudges,
        },
        messages: {
          browse: payload.browseMessage ?? "Treba vam pomoć pri biranju?",
          dessert: payload.dessertMessage ?? "Spremni za desert?",
          slowKitchen:
            payload.slowKitchenMessage ??
            "Kuhinja radi intenzivno — želite nešto da popijete dok čekate?",
          guestWelcome:
            "Dobro došli! Hoćete da pogledate meni?",
          billPrompt:
            "Hoćete da zatvorimo račun? Možete platiti ovde ili pozvati konobara.",
          orderDelay:
            "Vaša narudžbina se priprema, stiže uskoro. Hvala na strpljenju!",
          popularityPair:
            "Gosti često uzmu i nešto uz to — hoćete da dodam?",
        },
      });
    }
  }

  return apiSuccess({
    traceId,
    aiSessionId: timelineAiSessionId,
    schedulesUpserted,
    conflictPrompt,
    ingested: timelineAiSessionId !== null,
    proactiveNudge,
    quickReplies,
    partyMode: config.party.mode,
    partyDeviceCount: party?.activeDeviceCount ?? 0,
    isPrimaryDevice: party?.isCurrentDevicePrimary ?? false,
    sharedAiSessionId: party?.sharedAiSessionId ?? null,
    foldOrderCount: fold.meta.orderCount,
    foldPhase: fold.meta.phase,
  } satisfies DenisSenseResult);
}
