import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runSessionWatcherTick,
  runProactiveDailyJobs,
  processDenisFloorTick,
  processDenisSchedulerTick,
  runDenisLearnedEdgesAggregateTick,
} = vi.hoisted(() => ({
  runSessionWatcherTick: vi.fn(),
  runProactiveDailyJobs: vi.fn(),
  processDenisFloorTick: vi.fn(),
  processDenisSchedulerTick: vi.fn(),
  runDenisLearnedEdgesAggregateTick: vi.fn(),
}));

vi.mock("@/lib/denis/runtime/run-session-watcher", () => ({
  runSessionWatcherTick,
}));
vi.mock("@/lib/denis/runtime/run-proactive-daily-jobs", () => ({
  runProactiveDailyJobs,
}));
vi.mock("@/lib/denis/venue/floor/process-floor-tick", () => ({
  processDenisFloorTick,
}));
vi.mock("@/lib/denis/runtime/process-scheduler-tick", () => ({
  processDenisSchedulerTick,
}));
vi.mock("@/lib/admin/denis-learned-edges", () => ({
  runDenisLearnedEdgesAggregateTick,
}));

import { runDenisPilotTick } from "@/lib/denis/runtime/run-denis-pilot-tick";

describe("runDenisPilotTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runSessionWatcherTick.mockResolvedValue({
      scanned: 2,
      guestNudges: 1,
      staffAlerts: 0,
      skipped: 0,
    });
    runProactiveDailyJobs.mockResolvedValue({ ran: 0 });
    processDenisFloorTick.mockResolvedValue({
      scanned: 1,
      refreshed: 1,
      autoRushApplied: 0,
      skipped: 0,
    });
    processDenisSchedulerTick.mockResolvedValue({
      claimed: 0,
      emitted: 0,
      nudges: [],
    });
    runDenisLearnedEdgesAggregateTick.mockResolvedValue({
      scanned: 1,
      aggregated: 0,
      skipped: 1,
    });
  });

  it("runs all Denis background ticks in parallel", async () => {
    const admin = {} as never;
    const result = await runDenisPilotTick(admin, {
      sessionLimit: 10,
      floorLimit: 5,
    });

    expect(runSessionWatcherTick).toHaveBeenCalledWith(admin, { limit: 10 });
    expect(runProactiveDailyJobs).toHaveBeenCalledWith(admin);
    expect(processDenisFloorTick).toHaveBeenCalledWith(admin, { limit: 5 });
    expect(processDenisSchedulerTick).toHaveBeenCalled();
    expect(runDenisLearnedEdgesAggregateTick).toHaveBeenCalled();

    expect(result.sessionWatcher.scanned).toBe(2);
    expect(result.floor.refreshed).toBe(1);
  });
});
