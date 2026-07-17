import { describe, expect, it } from "vitest";
import { resolveStationVoiceRolloutEnabled } from "@/lib/denis/stations/resolve-station-voice-rollout";

describe("resolveStationVoiceRolloutEnabled", () => {
  it("is disabled when mode is off regardless of canaryPercent", () => {
    expect(
      resolveStationVoiceRolloutEnabled({
        mode: "off",
        canaryPercent: 100,
        locationId: "loc-1",
      })
    ).toBe(false);
  });

  it("is disabled when mode is shadow (log-only, never admits a location)", () => {
    expect(
      resolveStationVoiceRolloutEnabled({
        mode: "shadow",
        canaryPercent: 100,
        locationId: "loc-1",
      })
    ).toBe(false);
  });

  it("is disabled with no locationId even when live at 100%", () => {
    expect(
      resolveStationVoiceRolloutEnabled({
        mode: "live",
        canaryPercent: 100,
        locationId: null,
      })
    ).toBe(false);
  });

  it("admits every location when live at 100%", () => {
    expect(
      resolveStationVoiceRolloutEnabled({
        mode: "live",
        canaryPercent: 100,
        locationId: "any-location",
      })
    ).toBe(true);
  });

  it("admits no location when live at 0%", () => {
    expect(
      resolveStationVoiceRolloutEnabled({
        mode: "live",
        canaryPercent: 0,
        locationId: "any-location",
      })
    ).toBe(false);
  });

  it("is deterministic for a given locationId at a given percent", () => {
    const first = resolveStationVoiceRolloutEnabled({
      mode: "live",
      canaryPercent: 50,
      locationId: "stable-location-id",
    });
    const second = resolveStationVoiceRolloutEnabled({
      mode: "live",
      canaryPercent: 50,
      locationId: "stable-location-id",
    });
    expect(first).toBe(second);
  });
});
