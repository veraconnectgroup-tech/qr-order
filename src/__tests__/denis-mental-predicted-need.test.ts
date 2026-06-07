import { describe, expect, it } from "vitest";

import { synthesizePredictedNeed } from "@/lib/denis/cognition/mental-model/synthesize-predicted-need";

describe("synthesizePredictedNeed", () => {
  it("returns wants_drink during aperitif", () => {
    expect(
      synthesizePredictedNeed({
        intent: "waiting_food",
        mealStage: "aperitif",
        receptiveness: "open",
        pace: "normal",
      })
    ).toBe("wants_drink");
  });

  it("returns wants_dessert in dessert_window", () => {
    expect(
      synthesizePredictedNeed({
        intent: "waiting_food",
        mealStage: "dessert_window",
        receptiveness: "neutral",
        pace: "normal",
      })
    ).toBe("wants_dessert");
  });
});
