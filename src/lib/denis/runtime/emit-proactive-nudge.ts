import {
  buildBrowseFollowUpMessage,
  buildVenueWelcomeMessage,
} from "@/lib/denis/cognition/conversation/browsing-defer";
import { buildProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
import { scheduleDenisAnticipationCommerceProjection } from "@/lib/denis/runtime/schedule-denis-anticipation-commerce";
import { appendMentalModelGate } from "@/lib/denis/cognition/mental-model/append-mental-model-event";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { waiterObligationDedupeKey } from "@/lib/denis/cognition/waiter/detect-waiter-obligation-tell";
import { persistProactiveDockTell } from "@/lib/denis/loop/persist-proactive-dock-tell";
import { persistTableSessionView } from "@/lib/denis/loop/persist-table-session-view";
import {
  isProactiveDockDuplicate,
  proactiveDockMarkState,
  shouldCommitProactiveToDock,
} from "@/lib/denis/loop/proactive-dock-tell";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { SessionPhase } from "@/lib/scene/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

async function maybeExecuteAttentionHandoff(
  admin: SupabaseClient,
  input: {
    config: ConciergeConfig;
    tableId: string;
    locationId: string;
    sessionToken: string;
    nudge: GuestProactiveNudge;
    state: Parameters<typeof planProactiveTurn>[0]["state"];
  }
): Promise<void> {
  if (input.nudge.kind !== "attention_handoff") return;
  if (!input.config.handoff.waiterCall) return;
  if (!input.config.handoff.liveExecution) return;

  if (
    input.state.conversation.dismissedNudges.includes("attention_handoff") ||
    input.state.conversation.dismissedNudges.some((key) =>
      key.startsWith("waiter_gap:")
    )
  ) {
    return;
  }

  const handoff = await executeDenisWaiterHandoff(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    tableToken: input.state.table.token,
    sessionToken: input.sessionToken,
  });

  if (!handoff.ok) {
    logger.warn("attention_handoff ACL failed", {
      tableId: input.tableId,
      error: handoff.error,
    });
  }
}

export async function emitProactiveNudge(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId: string;
    tableId: string;
    locationId: string;
    sessionToken: string;
    venueName: string;
    config: ConciergeConfig;
    state: TableSessionState;
    orders: AiGuestOrder[];
    sessionPhase: SessionPhase;
    payload: Parameters<typeof planProactiveTurn>[0]["payload"];
    source: "session.watcher" | "sense.proactive_brain";
    traceId?: string;
  }
): Promise<GuestProactiveNudge | null> {
  const traceId = input.traceId ?? createTurnTraceId();
  const language =
    (typeof input.payload.language === "string" && input.payload.language) ||
    input.config.language.venueDefault ||
    "sr";

  const proactiveResult = planProactiveTurn({
    state: input.state,
    config: input.config,
    orders: input.orders,
    sessionPhase: input.sessionPhase,
    payload: input.payload,
    messages: {
      guestWelcome: buildVenueWelcomeMessage(input.venueName, language),
      browseFollowUp: buildBrowseFollowUpMessage(language),
    },
  });

  if (proactiveResult.mentalGate) {
    await appendMentalModelGate(admin, {
      aiSessionId: input.aiSessionId,
      traceId,
      mental: input.state.mental,
      mode: proactiveResult.mentalGate.mode,
      candidateKind: proactiveResult.mentalGate.candidateKind,
      allow: proactiveResult.mentalGate.allow,
      enforced: proactiveResult.mentalGate.enforced,
      reason: proactiveResult.mentalGate.reason,
      wouldBlock: proactiveResult.mentalGate.wouldBlock,
    });
  }

  if (!proactiveResult.nudge || !proactiveResult.message) {
    return null;
  }

  const nudge = proactiveResult.nudge;

  await maybeExecuteAttentionHandoff(admin, {
    config: input.config,
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: input.sessionToken,
    nudge,
    state: input.state,
  });

  const dedupeKey =
    nudge.kind === "waiter_gap"
      ? waiterObligationDedupeKey(input.state)
      : nudge.orderId
        ? `${nudge.kind}:${nudge.orderId}`
        : nudge.kind;

  const emittedPayload = buildProactiveEmittedPayload({
    state: input.state,
    nudge,
    message: proactiveResult.message,
    turnPlanKind: proactiveResult.turnPlan?.kind ?? null,
    turnPlanReason: proactiveResult.turnPlan?.reason ?? null,
    dedupeKey,
    source: input.source,
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "proactive.emitted",
    traceId,
    payload: emittedPayload,
  });

  scheduleDenisAnticipationCommerceProjection(admin, {
    kind: "nudge",
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
    traceId,
    payload: emittedPayload,
  });

  const dockMessage = proactiveResult.message.trim();
  if (
    dockMessage &&
    shouldCommitProactiveToDock(nudge.kind) &&
    !isProactiveDockDuplicate(
      input.state,
      { kind: nudge.kind, orderId: nudge.orderId },
      dockMessage
    )
  ) {
    await persistProactiveDockTell(admin, {
      aiSessionId: input.aiSessionId,
      traceId,
      kind: nudge.kind,
      message: dockMessage,
      orderId: nudge.orderId,
    });

    await persistTableSessionView(admin, {
      sessionId: input.tableSessionId,
      tableId: input.tableId,
      locationId: input.locationId,
      tableToken: input.sessionToken,
      venueName: input.venueName,
      tellResult: {
        headline: dockMessage,
        markState: proactiveDockMarkState(nudge.kind),
      },
    });
  }

  return nudge;
}
