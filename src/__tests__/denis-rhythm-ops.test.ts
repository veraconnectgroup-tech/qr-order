import { describe, expect, it } from "vitest";
import { evaluateRhythmOpsAlerts } from "@/lib/denis/config/evaluate-rhythm-ops-alerts";
import { rhythmSlotKey } from "@/lib/denis/config/resolve-rhythm-priors";

describe("evaluateRhythmOpsAlerts", () => {
  const basePriors = {
    version: 1 as const,
    slots: {
      [rhythmSlotKey(5, 19)]: {
        sampleSessions: 3,
        sessionDurationP50Min: 35,
        dessertDelayP50Min: 18,
        revenueEma: 80,
        topProducts: [],
        servicePeriod: "dinner" as const,
      },
      [rhythmSlotKey(5, 20)]: {
        sampleSessions: 4,
        sessionDurationP50Min: 40,
        dessertDelayP50Min: 18,
        revenueEma: 100,
        topProducts: [],
        servicePeriod: "dinner" as const,
      },
      [rhythmSlotKey(5, 21)]: {
        sampleSessions: 16,
        sessionDurationP50Min: 50,
        dessertDelayP50Min: 20,
        revenueEma: 220,
        topProducts: [],
        servicePeriod: "dinner" as const,
      },
    },
  };

  it("returns null outside :30 alert window", () => {
    expect(
      evaluateRhythmOpsAlerts({
        priors: basePriors,
        localDow: 5,
        localHour: 19,
        localMinute: 15,
        minSampleSessions: 8,
        rushThreshold: 1.8,
        rushAlerts: true,
        staffingHints: false,
        activeSessions: 4,
        totalSeats: 40,
        targetSessionsPerWaiter: 4,
      })
    ).toBeNull();
  });

  it("fires rush alert 30 min before hot slot", () => {
    const result = evaluateRhythmOpsAlerts({
      priors: basePriors,
      localDow: 5,
      localHour: 20,
      localMinute: 30,
      minSampleSessions: 8,
      rushThreshold: 1.8,
      rushAlerts: true,
      staffingHints: false,
      activeSessions: 6,
      totalSeats: 40,
      targetSessionsPerWaiter: 4,
    });

    expect(result?.rushAlert).toBe(true);
    expect(result?.nextHour).toBe(21);
    expect(result?.rushIndex).toBeGreaterThanOrEqual(1.8);
  });

  it("fires staffing hint when floor is busy before rush hour", () => {
    const result = evaluateRhythmOpsAlerts({
      priors: basePriors,
      localDow: 5,
      localHour: 20,
      localMinute: 30,
      minSampleSessions: 8,
      rushThreshold: 1.8,
      rushAlerts: false,
      staffingHints: true,
      activeSessions: 24,
      totalSeats: 40,
      targetSessionsPerWaiter: 4,
    });

    expect(result?.staffingAlert).toBe(true);
    expect(result?.suggestedWaiters).toBeGreaterThanOrEqual(4);
  });
});
