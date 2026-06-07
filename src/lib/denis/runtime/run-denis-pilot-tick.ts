import { runDenisLearnedEdgesAggregateTick } from "@/lib/admin/denis-learned-edges";
import { processDenisSchedulerTick } from "@/lib/denis/runtime/process-scheduler-tick";
import { runProactiveDailyJobs } from "@/lib/denis/runtime/run-proactive-daily-jobs";
import { runSessionWatcherTick } from "@/lib/denis/runtime/run-session-watcher";
import { processDenisFloorTick } from "@/lib/denis/venue/floor/process-floor-tick";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisPilotTickResult = {
  sessionWatcher: Awaited<ReturnType<typeof runSessionWatcherTick>>;
  proactiveDaily: Awaited<ReturnType<typeof runProactiveDailyJobs>>;
  floor: Awaited<ReturnType<typeof processDenisFloorTick>>;
  scheduler: Awaited<ReturnType<typeof processDenisSchedulerTick>>;
  learnedEdges: Awaited<ReturnType<typeof runDenisLearnedEdgesAggregateTick>>;
};

/** Single cron entrypoint for Hobby / external ping — runs all Denis background ticks. */
export async function runDenisPilotTick(
  admin: SupabaseClient,
  options?: {
    sessionLimit?: number;
    floorLimit?: number;
    schedulerLimit?: number;
    learnedLimit?: number;
  }
): Promise<DenisPilotTickResult> {
  const sessionLimit = options?.sessionLimit ?? 80;
  const floorLimit = options?.floorLimit ?? 50;
  const schedulerLimit = options?.schedulerLimit ?? 50;
  const learnedLimit = options?.learnedLimit ?? 50;

  const [sessionWatcher, proactiveDaily, floor, scheduler, learnedEdges] =
    await Promise.all([
      runSessionWatcherTick(admin, { limit: sessionLimit }),
      runProactiveDailyJobs(admin),
      processDenisFloorTick(admin, { limit: floorLimit }),
      processDenisSchedulerTick(admin, { limit: schedulerLimit }),
      runDenisLearnedEdgesAggregateTick(admin, { limit: learnedLimit }),
    ]);

  return {
    sessionWatcher,
    proactiveDaily,
    floor,
    scheduler,
    learnedEdges,
  };
}
