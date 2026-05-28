import { describe, expect, it } from "vitest";
import { composeScene, deriveSessionPhase } from "@/lib/scene/compose-scene";
import type { ComposeSceneInput } from "@/lib/scene/types";

const baseInput: ComposeSceneInput = {
  sessionId: "sess-1",
  tableName: "Sto 8",
  venueName: "Skyline Lounge",
  phase: "browsing",
  markState: "idle",
  denisActive: true,
  sheetOpen: false,
  sheetTitle: "Denis",
  thinking: false,
  blocking: null,
  banners: [],
  inlineRecommendations: [],
  chips: [],
};

describe("deriveSessionPhase", () => {
  it("returns closed when session ended", () => {
    expect(
      deriveSessionPhase({
        sessionClosed: true,
        hasOpenKitchenOrders: false,
        hasCartActivity: false,
        billSettled: false,
        allOrdersDelivered: false,
      })
    ).toBe("closed");
  });

  it("returns waiting when kitchen orders are open", () => {
    expect(
      deriveSessionPhase({
        sessionClosed: false,
        hasOpenKitchenOrders: true,
        hasCartActivity: false,
        billSettled: false,
        allOrdersDelivered: false,
      })
    ).toBe("waiting");
  });

  it("returns settling when bill settled", () => {
    expect(
      deriveSessionPhase({
        sessionClosed: false,
        hasOpenKitchenOrders: false,
        hasCartActivity: true,
        billSettled: true,
        allOrdersDelivered: false,
      })
    ).toBe("settling");
  });
});

describe("composeScene", () => {
  it("orders layers by precedence: blocking before banner before chips", () => {
    const scene = composeScene({
      ...baseInput,
      blocking: { reason: "conflict", message: "Cart mismatch" },
      banners: [{ id: "nudge-1", message: "Room for dessert?" }],
      chips: [{ id: "vegan", label: "Vegan" }],
    });

    expect(scene.layers.map((l) => l.kind)).toEqual([
      "blocking",
      "banner",
      "chips",
      "ambient",
    ]);
  });

  it("includes sheet when thinking even if panel closed", () => {
    const scene = composeScene({
      ...baseInput,
      thinking: true,
      sheetOpen: false,
    });

    expect(scene.layers.some((l) => l.kind === "sheet" && l.thinking)).toBe(true);
  });

  it("omits ambient when Denis inactive", () => {
    const scene = composeScene({
      ...baseInput,
      denisActive: false,
    });

    expect(scene.layers.some((l) => l.kind === "ambient")).toBe(false);
  });

  it("increments version from caller", () => {
    const scene = composeScene(baseInput, 42);
    expect(scene.version).toBe(42);
    expect(scene.chrome.tableName).toBe("Sto 8");
  });
});
