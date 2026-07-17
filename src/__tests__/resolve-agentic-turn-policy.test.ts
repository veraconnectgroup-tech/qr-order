import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  agenticUsesLegacySingleCallFallback,
  resolveAgenticTurnPolicy,
} from "@/lib/denis/agentic/resolve-agentic-turn-policy";

describe("resolveAgenticTurnPolicy", () => {
  it("returns off when disabled", () => {
    expect(
      resolveAgenticTurnPolicy(
        {
          ...CONCIERGE_PLATFORM_DEFAULTS,
          ops: {
            ...CONCIERGE_PLATFORM_DEFAULTS.ops,
            agenticToolLoop: {
              enabled: false,
              shadowOnly: true,
              canaryPercent: 100,
              maxRounds: 3,
              legacySingleCallFallback: true,
              creditsPerExtraRound: 0,
            },
          },
        },
        "cohort-1"
      )
    ).toEqual({ mode: "off" });
  });

  it("returns shadow when enabled in cohort with shadowOnly", () => {
    expect(
      resolveAgenticTurnPolicy(
        {
          ...CONCIERGE_PLATFORM_DEFAULTS,
          ops: {
            ...CONCIERGE_PLATFORM_DEFAULTS.ops,
            agenticToolLoop: {
              enabled: true,
              shadowOnly: true,
              canaryPercent: 100,
              maxRounds: 3,
              legacySingleCallFallback: true,
              creditsPerExtraRound: 0,
            },
          },
        },
        "cohort-1"
      )
    ).toEqual({ mode: "shadow" });
  });

  it("returns live when shadowOnly is false and cohort matches", () => {
    expect(
      resolveAgenticTurnPolicy(
        {
          ...CONCIERGE_PLATFORM_DEFAULTS,
          ops: {
            ...CONCIERGE_PLATFORM_DEFAULTS.ops,
            agenticToolLoop: {
              enabled: true,
              shadowOnly: false,
              canaryPercent: 100,
              maxRounds: 3,
              legacySingleCallFallback: true,
              creditsPerExtraRound: 0,
            },
          },
        },
        "cohort-1"
      )
    ).toEqual({
      mode: "live",
      dryRun: false,
      legacySingleCallFallback: true,
    });
  });

  it("detects P5 legacy path removal at 100% live canary", () => {
    expect(
      agenticUsesLegacySingleCallFallback({
        ...CONCIERGE_PLATFORM_DEFAULTS,
        ops: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops,
          agenticToolLoop: {
            enabled: true,
            shadowOnly: false,
            canaryPercent: 100,
            maxRounds: 3,
            legacySingleCallFallback: false,
            creditsPerExtraRound: 0,
          },
        },
      })
    ).toBe(true);
  });
});
