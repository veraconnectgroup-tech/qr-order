import { describe, expect, it } from "vitest";
import { composeScene } from "@/lib/scene/compose-scene";
import { sceneStaffDetail, sceneStaffTile } from "@/lib/scene/staff-views";
import type { ComposeSceneInput } from "@/lib/scene/types";

const input: ComposeSceneInput = {
  sessionId: "sess-1",
  tableName: "8",
  venueName: "Skyline Lounge",
  phase: "ordering",
  markState: "think",
  denisActive: true,
  sheetOpen: true,
  sheetTitle: "Denis",
  thinking: false,
  blocking: null,
  banners: [{ id: "rush", message: "Kitchen is busy — drinks first?" }],
  inlineRecommendations: [],
  chips: [],
  situation: null,
};

describe("staff scene views", () => {
  it("staff tile exposes denisActive and alert from banner", () => {
    const scene = composeScene(input, 3);
    const tile = sceneStaffTile(scene);

    expect(tile.denisActive).toBe(true);
    expect(tile.phase).toBe("ordering");
    expect(tile.alertMessage).toBe("Kitchen is busy — drinks first?");
  });

  it("staff detail includes full layers", () => {
    const scene = composeScene(input, 3);
    const detail = sceneStaffDetail(scene);

    expect(detail.version).toBe(3);
    expect(detail.venueName).toBe("Skyline Lounge");
    expect(detail.layers.length).toBeGreaterThan(0);
  });
});
