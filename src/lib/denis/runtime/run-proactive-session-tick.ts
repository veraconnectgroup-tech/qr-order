import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import { detectTableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import { orchestrateTableLifecycle } from "@/lib/denis/cognition/lifecycle/orchestrate-table-lifecycle";
import { hasActiveDrinkOrder } from "@/lib/denis/cognition/proactive/triggers";
import { loadProactiveMenuHints } from "@/lib/denis/cognition/proactive/load-proactive-menu-hints";
import { loadAdminUpsellMatches } from "@/lib/upsell/load-admin-matches";
import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import { maybeAppendMentalModelUpdated } from "@/lib/denis/cognition/mental-model/append-mental-model-event";
import { maybeAppendOfferResolved } from "@/lib/denis/cognition/offer/append-offer-event";
import { maybeAppendOfferConverted } from "@/lib/denis/cognition/offer/append-offer-converted";
import { maybeAppendNudgeOutcomes } from "@/lib/denis/cognition/offer/append-nudge-outcome";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadRevenueInsight } from "@/lib/denis/config/load-revenue-insight";
import {
  loadRhythmRuntimeContext,
} from "@/lib/denis/config/load-rhythm-prep-products";
import {
  resolveEffectiveDessertDelayMinutes,
} from "@/lib/denis/config/resolve-rhythm-priors";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { emitProactiveNudge } from "@/lib/denis/runtime/emit-proactive-nudge";
import { scheduleDenisAnticipationCommerceProjection } from "@/lib/denis/runtime/schedule-denis-anticipation-commerce";
import { scheduleNudgeOutcomeCommerceProjection } from "@/lib/denis/runtime/schedule-nudge-outcome-commerce";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProactiveSessionTickSource =
  | "session.watcher"
  | "scheduler.wakeup"
  | "sense.proactive_brain";

export type ProactiveSessionTickInput = {
  tableSessionId: string;
  source: ProactiveSessionTickSource;
  traceId?: string;
  preambleDone?: boolean;
};

type TableSessionRow = {
  id: string;
  table_id: string;
  location_id: string;
  session_token: string;
  opened_at: string;
  denis_shared_ai_session_id: string;
  location: { name: string } | { name: string }[] | null;
};

function relationName(
  relation: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.name ?? null;
  return relation.name ?? null;
}

/** Fold + optional preamble + UPDS emit — shared by watcher, scheduler, actor (ADR-041 P1). */
export async function runProactiveSessionTick(
  admin: SupabaseClient,
  input: ProactiveSessionTickInput
): Promise<GuestProactiveNudge | null> {
  const { data: row, error } = await admin
    .from("table_sessions")
    .select(
      `
      id,
      table_id,
      location_id,
      session_token,
      opened_at,
      denis_shared_ai_session_id,
      location:locations(name)
    `
    )
    .eq("id", input.tableSessionId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !row) {
    logger.warn("runProactiveSessionTick session missing", {
      tableSessionId: input.tableSessionId,
      error: error?.message,
    });
    return null;
  }

  const session = row as TableSessionRow;
  const config = await loadConciergeConfigForLocation(session.location_id);
  if (!config.proactive.enabled) {
    return null;
  }

  const aiSessionId = session.denis_shared_ai_session_id;
  const venueName = relationName(session.location)?.trim() || "Venue";
  const traceId = input.traceId ?? createTurnTraceId();

  const [timeline, orders, fold] = await Promise.all([
    loadDenisTimeline(admin, aiSessionId),
    loadGuestOrdersForAi(admin, session.table_id, session.session_token),
    foldTableSessionState(admin, {
      locationId: session.location_id,
      tableId: session.table_id,
      sessionToken: session.session_token,
      tableSessionId: session.id,
      aiSessionId,
      config,
    }),
  ]);

  const cartLines = fold.state.commerce.cart.visibleLines;
  const cartProductIds = cartLines.map((line) => line.productId);
  const hints = await loadProactiveMenuHints(admin, session.location_id, {
    cartProductIds,
  });

  const watcherContext = buildSessionWatcherContext({
    timeline,
    orders,
    sessionOpenedAt: session.opened_at,
    venueDefaultLanguage: config.language.venueDefault ?? "sr",
  });

  if (input.source === "session.watcher" && !input.preambleDone) {
    await maybeAppendMentalModelUpdated(admin, {
      aiSessionId,
      traceId,
      timeline: fold.state.timeline,
      mental: fold.state.mental,
      contextHash: fold.meta.truthHash,
    });
    await maybeAppendOfferResolved(admin, {
      aiSessionId,
      traceId,
      timeline: fold.state.timeline,
      offer: fold.state.offer,
      contextHash: fold.meta.truthHash,
    });
    const converted = await maybeAppendOfferConverted(admin, {
      aiSessionId,
      traceId,
      timeline: fold.state.timeline,
      contextHash: fold.meta.truthHash,
    });
    const nudgeOutcomes = await maybeAppendNudgeOutcomes(admin, {
      aiSessionId,
      traceId,
      timeline: fold.state.timeline,
      contextHash: fold.meta.truthHash,
    });
    if (nudgeOutcomes.length > 0) {
      scheduleNudgeOutcomeCommerceProjection(admin, {
        aiSessionId,
        tableSessionId: session.id,
        traceId,
        outcomes: nudgeOutcomes,
      });
    }
    if (converted.length > 0) {
      scheduleDenisAnticipationCommerceProjection(admin, {
        kind: "offer_converted",
        aiSessionId,
        tableSessionId: session.id,
        traceId,
        conversions: converted,
      });
    }
  }

  const mentalMode = resolveMentalModelMode(config);
  const rhythm = await loadRhythmRuntimeContext(admin, {
    locationId: session.location_id,
    config,
  });
  const revenueInsight = await loadRevenueInsight(admin, {
    locationId: session.location_id,
    config,
    rhythm,
  });
  const effectiveDessertDelayMinutes = resolveEffectiveDessertDelayMinutes(
    config,
    rhythm
  );
  const rhythmTopProductName =
    rhythm.applied && rhythm.topProducts[0]?.name
      ? rhythm.topProducts[0].name
      : null;
  const legacyMinutePayload =
    mentalMode === "off"
      ? {
          idleMinutes: watcherContext.idleMinutes,
          browseMinutes: watcherContext.idleMinutes,
        }
      : {};

  const cartTotalEuros = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const tableTempoPhase = config.ops.tableTempo.enabled
    ? detectTableTempoPhase({
        sessionOpenedAt: session.opened_at,
        orders: fold.state.commerce.orders,
        guestMessageCount: watcherContext.guestMessageCount,
        idleMinutes: watcherContext.idleMinutes,
        config: config.ops.tableTempo,
      })
    : "none";
  const tableLifecycle = orchestrateTableLifecycle({
    mental: fold.state.mental,
    tableTempoPhase,
    orders: fold.state.commerce.orders,
    cartLineCount: fold.state.commerce.cart.visibleLines.length,
  });
  const adminUpsellMatches =
    cartProductIds.length > 0
      ? await loadAdminUpsellMatches(admin, {
          locationId: session.location_id,
          cartProductIds,
          cartTotalEuros,
          dismissedNudgeKeys: watcherContext.dismissedNudgeKeys,
          respectDecline: config.upsell.respectDecline,
        })
      : [];

  return emitProactiveNudge(admin, {
    aiSessionId,
    tableSessionId: session.id,
    tableId: session.table_id,
    locationId: session.location_id,
    sessionToken: session.session_token,
    venueName,
    config,
    state: fold.state,
    orders,
    sessionPhase: deriveFoldSessionPhase({
      sessionStatus: fold.state.session.status,
      accessState: fold.state.session.accessState,
      orders: fold.state.commerce.orders,
      hasCartActivity: fold.state.commerce.cart.visibleLines.length > 0,
      billSettled: fold.state.session.billSettled,
    }),
    source: input.source,
    traceId,
    payload: {
      dismissedNudgeKeys: watcherContext.dismissedNudgeKeys,
      hasSessionOrders: fold.state.commerce.orders.length > 0,
      cartItemCount: fold.state.commerce.cart.visibleLines.length,
      sessionAgeSeconds: watcherContext.sessionAgeSeconds,
      guestMessageCount: watcherContext.guestMessageCount,
      guestAskedRecommendation: watcherContext.guestAskedRecommendation,
      popularityPair: hints.popularityPair,
      todaySpecial: hints.todaySpecial,
      dessertProductName: hints.dessertProductName,
      puzzleProductName: hints.puzzleProductName,
      menuEngineeringCategories: hints.menuEngineeringCategories,
      effectiveDessertDelayMinutes,
      rhythmTopProductName,
      revenueStrategy: revenueInsight?.strategy ?? null,
      ...legacyMinutePayload,
      venueName,
      language:
        input.source === "scheduler.wakeup"
          ? config.language.venueDefault ?? "sr"
          : watcherContext.guestMessageCount > 0
            ? watcherContext.guestLanguage ??
              config.language.venueDefault ??
              "sr"
            : config.language.venueDefault ?? "sr",
      browsingDeferredAt: watcherContext.browsingDeferredAt,
      browsingDeferCount: watcherContext.browsingDeferCount,
      browseFollowUpEmitted: watcherContext.browseFollowUpEmitted,
      followUpRequestedAt: watcherContext.followUpRequestedAt,
      followUpDelaySeconds: watcherContext.followUpDelaySeconds,
      adminUpsellMatches,
      tableTempoPhase,
      tableLifecycle,
    },
  });
}
