import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { enqueueOrRunProactiveSessionTick } from "@/lib/denis/runtime/enqueue-or-run-proactive-tick";
import {
  claimDueDenisSchedules,
  completeDenisSchedule,
  type ScheduleTickResult,
} from "@/lib/denis/kernel/scheduler";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
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

      const { data: tableSessionRow } = await admin
        .from("table_sessions")
        .select("id")
        .eq("denis_shared_ai_session_id", schedule.ai_session_id)
        .eq("status", "active")
        .maybeSingle();

      const tableSession = tableSessionRow as { id: string } | null;

      if (!tableSession) {
        await completeDenisSchedule(admin, schedule.id, "cancelled");
        continue;
      }

      const traceId = createTurnTraceId();
      const nudge = await enqueueOrRunProactiveSessionTick(admin, {
        tableSessionId: tableSession.id,
        source: "scheduler.wakeup",
        traceId,
        config,
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
