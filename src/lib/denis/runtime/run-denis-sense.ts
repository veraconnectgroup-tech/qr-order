import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { appendMindBeliefsCompiled } from "@/lib/denis/cognition/beliefs/append-mind-beliefs-compiled";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import { appendMindFoldCompleted } from "@/lib/denis/loop/append-fold-completed";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { persistProactiveDockTell } from "@/lib/denis/loop/persist-proactive-dock-tell";
import { persistTableSessionView } from "@/lib/denis/loop/persist-table-session-view";
import {
  isProactiveDockDuplicate,
  proactiveDockMarkState,
  shouldCommitProactiveToDock,
} from "@/lib/denis/loop/proactive-dock-tell";
import { manualSnapshotToDenisDraft } from "@/lib/denis/loop/adapters/map-cart-snapshot";
import { mapGuestOrdersToSchedulerSnapshot } from "@/lib/denis/runtime/adapters/map-scheduler-orders";
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
    sessionToken: input.sessionToken,
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

    const proactiveResult = planProactiveTurn({
      state,
      config,
      orders: guestOrders,
      sessionPhase: fold.meta.phase,
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
      },
    });

    if (draftAiSessionId) {
      await appendMindBeliefsCompiled(admin, {
        aiSessionId: draftAiSessionId,
        traceId,
        graph: proactiveResult.beliefs,
        truthHash: fold.meta.truthHash,
      });
    }

    if (proactiveResult.nudge && aiSessionId) {
      proactiveNudge = proactiveResult.nudge;

      await appendDenisTimelineEvent(admin, {
        aiSessionId,
        eventType: "proactive.emitted",
        traceId,
        payload: {
          type: "proactive.emitted",
          kind: proactiveResult.nudge.kind,
          message: proactiveResult.nudge.message,
          orderId: proactiveResult.nudge.orderId ?? null,
          tier: "template",
          turnPlanKind: proactiveResult.turnPlan?.kind ?? null,
          turnPlanReason: proactiveResult.turnPlan?.reason ?? null,
          source: "sense.proactive_brain",
        },
      });

      const dockMessage = proactiveResult.message?.trim();
      if (
        dockMessage &&
        shouldCommitProactiveToDock(proactiveResult.nudge.kind) &&
        !isProactiveDockDuplicate(
          state,
          {
            kind: proactiveResult.nudge.kind,
            orderId: proactiveResult.nudge.orderId,
          },
          dockMessage
        ) &&
        tableSessionId
      ) {
        await persistProactiveDockTell(admin, {
          aiSessionId,
          traceId,
          kind: proactiveResult.nudge.kind,
          message: dockMessage,
          orderId: proactiveResult.nudge.orderId,
        });

        await persistTableSessionView(admin, {
          sessionId: tableSessionId,
          tableId: input.tableId,
          locationId: input.locationId,
          tableToken: input.sessionToken,
          venueName: guestContext.data.orgName,
          tellResult: {
            headline: dockMessage,
            markState: proactiveDockMarkState(proactiveResult.nudge.kind),
          },
        });
      }
    }
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
    partyDeviceCount: party?.activeDeviceCount ?? 0,
    isPrimaryDevice: party?.isCurrentDevicePrimary ?? false,
    sharedAiSessionId: party?.sharedAiSessionId ?? null,
    foldOrderCount: fold.meta.orderCount,
    foldPhase: fold.meta.phase,
  } satisfies DenisSenseResult);
}
