import { describe, expect, it } from "vitest";
import { resolveDegradationFallbackTurn } from "@/lib/denis/config/degradation-fallback-intents";
import { isDegradationFeatureDisabled } from "@/lib/denis/config/degradation-ladder";

describe("degradation fallback intents", () => {
  it("returns template payment message without LLM at fallback", () => {
    const turn = resolveDegradationFallbackTurn({
      guestMessage: "hoću da platim",
      language: "sr",
      level: "fallback",
    });

    expect(turn).not.toBeNull();
    expect(turn?.allowTurnPipeline).toBe(false);
    expect(turn?.message.toLowerCase()).toMatch(/plati/);
    expect(turn?.quickReplies.length).toBeGreaterThan(0);
  });

  it("allows ordering pipeline for order intent at fallback", () => {
    const turn = resolveDegradationFallbackTurn({
      guestMessage: "dodaj dva piva",
      language: "sr",
      level: "fallback",
    });

    expect(turn?.allowTurnPipeline).toBe(true);
  });

  it("does not activate below fallback level", () => {
    expect(
      resolveDegradationFallbackTurn({
        guestMessage: "status porudžbine",
        language: "sr",
        level: "essential",
      })
    ).toBeNull();
  });
});

describe("degradation feature gates", () => {
  it("disables scene intelligence at reduced", () => {
    expect(isDegradationFeatureDisabled("reduced", "scene_intelligence")).toBe(
      true
    );
    expect(isDegradationFeatureDisabled("full", "scene_intelligence")).toBe(
      false
    );
  });

  it("disables tips at essential", () => {
    expect(isDegradationFeatureDisabled("essential", "tips")).toBe(true);
  });
});
