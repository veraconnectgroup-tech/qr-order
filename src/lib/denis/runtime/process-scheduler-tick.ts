import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import { loadProactiveMenuHints } from "@/lib/denis/cognition/proactive/load-proactive-menu-hints";
import { emitProactiveNudge } from "@/lib/denis/runtime/emit-proactive-nudge";
import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import {
  claimDueDenisSchedules,
  completeDenisSchedule,
  type ScheduleTickResult,
} from "@/lib/denis/kernel/scheduler";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Process due anticipation jobs — wake UPDS brain (ADR-040 P3). */
export async function processDenisSchedulerTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<ScheduleTickResult> {
  const due = await claimDueDenisSchedules(admin, options?.limit ?? 50);
  const nudges: ScheduleTickResult["nudges"] = [];
  let emitted = 0;

  for (const schedule of due) {
    try {
      const config = await loadConciergeConfigForLocation(schedule.location_id);
      if (!config.proactive.enabled) {
        await completeDenisSchedule(admin, schedule.id, "cancelled");
        continue;
      }

      const { data: sessionRow } = await admin
        .from("ai_sessions")
        .select("table_id, session_token")
        .eq("id", schedule.ai_session_id)
        .maybeSingle();

      const session = sessionRow as {
        table_id: string;
        session_token: string;
      } | null;

      if (!session) {
        await completeDenisSchedule(admin, schedule.id, "cancelled");
        continue;
      }

      const { data: tableSessionRow } = await admin
        .from("table_sessions")
        .select("id, opened_at, location:locations(name), table:tables(name)")
        .eq("denis_shared_ai_session_id", schedule.ai_session_id)
        .eq("status", "active")
        .maybeSingle();

      const tableSession = tableSessionRow as {
        id: string;
        opened_at: string;
        location: { name: string } | { name: string }[] | null;
        table: { name: string } | { name: string }[] | null;
      } | null;

      if (!tableSession) {
        await completeDenisSchedule(admin, schedule.id, "cancelled");
        continue;
      }

      const venueName = (() => {
        const loc = tableSession.location;
        if (!loc) return "Venue";
        if (Array.isArray(loc)) return loc[0]?.name ?? "Venue";
        return loc.name ?? "Venue";
      })();

      const [orders, fold, timeline, hints] = await Promise.all([
        loadGuestOrdersForAi(admin, session.table_id, session.session_token),
        foldTableSessionState(admin, {
          locationId: schedule.location_id,
          tableId: session.table_id,
          sessionToken: session.session_token,
          tableSessionId: tableSession.id,
          aiSessionId: schedule.ai_session_id,
          config,
        }),
        loadDenisTimeline(admin, schedule.ai_session_id),
        loadProactiveMenuHints(admin, schedule.location_id),
      ]);

      const watcherContext = buildSessionWatcherContext({
        timeline,
        orders,
        sessionOpenedAt: tableSession.opened_at,
        venueDefaultLanguage: config.language.venueDefault ?? "sr",
      });

      const mentalMode = resolveMentalModelMode(config);
      const legacyMinutePayload =
        mentalMode === "off"
          ? {
              idleMinutes: watcherContext.idleMinutes,
              browseMinutes: watcherContext.idleMinutes,
            }
          : {};

      const traceId = createTurnTraceId();
      const nudge = await emitProactiveNudge(admin, {
        aiSessionId: schedule.ai_session_id,
        tableSessionId: tableSession.id,
        tableId: session.table_id,
        locationId: schedule.location_id,
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
        source: "scheduler.wakeup",
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
          ...legacyMinutePayload,
          venueName,
          language: config.language.venueDefault ?? "sr",
          browsingDeferredAt: watcherContext.browsingDeferredAt,
          browsingDeferCount: watcherContext.browsingDeferCount,
          browseFollowUpEmitted: watcherContext.browseFollowUpEmitted,
          followUpRequestedAt: watcherContext.followUpRequestedAt,
          followUpDelaySeconds: watcherContext.followUpDelaySeconds,
        },
      });

      if (nudge) {
        nudges.push({
          kind: nudge.kind,
          message: nudge.message,
          orderId: nudge.orderId,
          templateTier: "template",
        });
        emitted += 1;
      }

      await completeDenisSchedule(admin, schedule.id, "completed");
    } catch (error) {
      logger.warn("processDenisSchedulerTick row failed", {
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await completeDenisSchedule(admin, schedule.id, "cancelled");
    }
  }

  return {
    processed: due.length,
    emitted,
    nudges,
  };
}
