import { describe, expect, it } from "vitest";
import { shouldArmStationEar } from "@/hooks/use-denis-station-ear";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";

describe("shouldArmStationEar", () => {
  it("arms only when hands-free is enabled, the browser supports it, and no call is active", () => {
    expect(
      shouldArmStationEar({
        handsFreeEnabled: true,
        browserSupported: true,
        callActive: false,
      })
    ).toBe(true);
  });

  it("never arms while a call is active — the ear must not re-trigger over a live session", () => {
    expect(
      shouldArmStationEar({
        handsFreeEnabled: true,
        browserSupported: true,
        callActive: true,
      })
    ).toBe(false);
  });

  it("never arms when the per-location flag is off", () => {
    expect(
      shouldArmStationEar({
        handsFreeEnabled: false,
        browserSupported: true,
        callActive: false,
      })
    ).toBe(false);
  });

  it("never arms without browser support", () => {
    expect(
      shouldArmStationEar({
        handsFreeEnabled: true,
        browserSupported: false,
        callActive: false,
      })
    ).toBe(false);
  });
});

describe("handsFreeWakeWordEnabled config flag (ADR-053 P1)", () => {
  it("ships dark — platform default is off", () => {
    expect(
      CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions.handsFreeWakeWordEnabled
    ).toBe(false);
  });

  it("stays off through the org→location merge when nothing overrides it", () => {
    const merged = mergeConciergeConfig(undefined, null, null);
    expect(merged.ops.stationQuestions.handsFreeWakeWordEnabled).toBe(false);
  });

  it("a per-location override turns it on through the real merge path", () => {
    const merged = mergeConciergeConfig(undefined, null, {
      ops: {
        stationQuestions: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
          handsFreeWakeWordEnabled: true,
        },
      },
    });
    expect(merged.ops.stationQuestions.handsFreeWakeWordEnabled).toBe(true);
  });
});
