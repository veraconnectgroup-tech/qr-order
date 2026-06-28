import { describe, expect, it } from "vitest";
import { checkPilotReadiness } from "@/lib/denis/config/pilot-venue-checklist";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildPilotStagePatch } from "@/lib/denis/config/pilot-cutover-ladder";
import {
  initialPilotCutoverStage,
  nextPilotCutoverStage,
} from "@/lib/denis/config/pilot-cutover-ladder";

describe("pilot cutover ladder H1", () => {
  it("starts at canary 10 and advances through denis_only", () => {
    expect(initialPilotCutoverStage()).toBe("canary_10");
    expect(nextPilotCutoverStage(null)).toBe("canary_10");
    expect(nextPilotCutoverStage("canary_10")).toBe("canary_50");
    expect(nextPilotCutoverStage("canary_50")).toBe("canary_100");
    expect(nextPilotCutoverStage("canary_100")).toBe("denis_only");
    expect(nextPilotCutoverStage("denis_only")).toBeNull();
  });

  it("canary patch never skips to denis_only on first step", () => {
    const first = buildPilotStagePatch("canary_10");
    expect(first.rollout?.mode).toBe("canary");
    expect(first.rollout?.canaryPercent).toBe(10);
  });
});

describe("checkPilotReadiness H1", () => {
  it("blocks when one blocker fails", async () => {
    const readiness = await checkPilotReadiness(
      {} as never,
      "loc-test",
      {
        config: {
          ...CONCIERGE_PLATFORM_DEFAULTS,
          proactive: {
            ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
            staffAllergy: false,
          },
        },
        pilotCutover: null,
        deps: {
          evalPassRatePct: 96,
          actOrderErrors7d: 0,
          completedSessions: 25,
          staffCopilotAcknowledged: true,
        },
      }
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.some((b) => b.includes("Allergy"))).toBe(true);
  });

  it("is ready when all blockers pass", async () => {
    const readiness = await checkPilotReadiness(
      {} as never,
      "loc-test",
      {
        config: {
          ...CONCIERGE_PLATFORM_DEFAULTS,
          proactive: {
            ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
            staffAllergy: true,
          },
          ops: {
            ...CONCIERGE_PLATFORM_DEFAULTS.ops,
            floorGraphEnabled: true,
          },
        },
        pilotCutover: null,
        deps: {
          evalPassRatePct: 96,
          actOrderErrors7d: 0,
          completedSessions: 25,
          staffCopilotAcknowledged: true,
        },
      }
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
  });
});
