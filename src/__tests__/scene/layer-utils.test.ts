import { describe, expect, it } from "vitest";
import { composeScene } from "@/lib/scene/compose-scene";
import { sceneBannerLayers, sceneSheetLayer } from "@/lib/scene/layer-utils";

describe("scene layer utils", () => {
  it("extracts banner and sheet layers", () => {
    const scene = composeScene({
      sessionId: "s1",
      tableName: "8",
      venueName: "Skyline",
      phase: "browsing",
      markState: "idle",
      denisActive: true,
      sheetOpen: true,
      sheetTitle: "Denis",
      thinking: false,
      blocking: null,
      banners: [{ id: "rush", message: "Kitchen busy" }],
      inlineRecommendations: [],
      chips: [],
    });

    expect(sceneBannerLayers(scene)).toHaveLength(1);
    expect(sceneSheetLayer(scene)?.open).toBe(true);
  });
});
