import {
  buildBrowseFollowUpMessage,
  buildVenueWelcomeMessage,
} from "@/lib/denis/cognition/conversation/browsing-defer";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
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

  if (!proactiveResult.nudge || !proactiveResult.message) {
    return null;
  }

  const nudge = proactiveResult.nudge;
  const dedupeKey = nudge.orderId
    ? `${nudge.kind}:${nudge.orderId}`
    : nudge.kind;

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "proactive.emitted",
    traceId,
    payload: {
      type: "proactive.emitted",
      kind: nudge.kind,
      message: proactiveResult.message,
      orderId: nudge.orderId ?? null,
      tier: "template",
      turnPlanKind: proactiveResult.turnPlan?.kind ?? null,
      turnPlanReason: proactiveResult.turnPlan?.reason ?? null,
      dedupeKey,
      source: input.source,
    },
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
