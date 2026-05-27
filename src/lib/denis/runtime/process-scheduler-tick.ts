import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { mapGuestOrdersToSchedulerSnapshot } from "@/lib/denis/runtime/adapters/map-scheduler-orders";
import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import {
  claimDueDenisSchedules,
  completeDenisSchedule,
  evaluateScheduledIntent,
  loadShownProactiveKeys,
  type ScheduleTickResult,
} from "@/lib/denis/kernel/scheduler";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Process due anticipation jobs — called from cron (M8). */
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

      const orders = mapGuestOrdersToSchedulerSnapshot(
        await loadGuestOrdersForAi(
          admin,
          session.table_id,
          session.session_token
        )
      );

      const shownNudgeKeys = await loadShownProactiveKeys(
        admin,
        schedule.ai_session_id
      );

      const evaluation = evaluateScheduledIntent({
        intentType: schedule.intent_type,
        payload: schedule.payload ?? {},
        orders,
        shownNudgeKeys,
        slowKitchenThresholdMinutes:
          config.proactive.slowKitchenThresholdMinutes,
      });

      if (evaluation) {
        const traceId = createTurnTraceId();
        await appendDenisTimelineEvent(admin, {
          aiSessionId: schedule.ai_session_id,
          eventType: "proactive.emitted",
          traceId,
          payload: {
            type: "proactive.emitted",
            kind: evaluation.kind,
            message: evaluation.message,
            orderId: evaluation.orderId ?? null,
            tier: evaluation.templateTier,
            dedupeKey: schedule.dedupe_key,
            scheduleId: schedule.id,
          },
        });
        nudges.push(evaluation);
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
