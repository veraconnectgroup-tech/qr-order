import { describe, expect, it } from "vitest";
import {
  mapTurnQuickRepliesToChips,
  mapTurnRecommendationsToInline,
  mapTurnToSceneOverrides,
} from "@/lib/scene/map-turn-to-scene-overrides";

describe("mapTurnToSceneOverrides", () => {
  it("maps quick replies and recommendations into scene refresh payload", () => {
    const payload = mapTurnToSceneOverrides({
      tableSessionId: "sess-1",
      quickReplies: ["Ja", "Nein, danke"],
      recommendations: [
        {
          productId: "p1",
          reason: "Light option",
          productName: "Caesar Salad",
          price: 12.5,
        },
      ],
      markState: "idle",
    });

    expect(payload.sessionId).toBe("sess-1");
    expect(payload.chips).toEqual([
      { id: "chip-ja", label: "Ja" },
      { id: "chip-nein-danke", label: "Nein, danke" },
    ]);
    expect(payload.inlineRecommendations).toEqual([
      {
        productId: "p1",
        name: "Caesar Salad",
        reason: "Light option",
        priceCents: 1250,
      },
    ]);
  });

  it("dedupes empty chip labels", () => {
    expect(mapTurnQuickRepliesToChips(["  ", "Ok"])).toEqual([
      { id: "chip-ok", label: "Ok" },
    ]);
  });

  it("falls back to product map names", () => {
    expect(
      mapTurnRecommendationsToInline(
        [{ productId: "p2", reason: "Popular" }],
        { p2: "Sea Bass" }
      )
    ).toEqual([
      {
        productId: "p2",
        name: "Sea Bass",
        reason: "Popular",
        priceCents: undefined,
      },
    ]);
  });
});
