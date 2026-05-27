import { describe, expect, it } from "vitest";
import {
  acceptRate,
  aggregateSessionPairStats,
  meetsLearnedEdgeThreshold,
  suggestedWeightFromAcceptRate,
} from "@/lib/denis/learning";

describe("learned edge aggregate M16", () => {
  it("counts impressions and accepts per anchor→recommended pair", () => {
    const stats = aggregateSessionPairStats([
      {
        productsRecommended: ["beer", "fries"],
        productsAdded: ["burger", "beer"],
      },
      {
        productsRecommended: ["beer"],
        productsAdded: ["burger"],
      },
    ]);

    const beer = stats.find(
      (row) => row.fromProductId === "burger" && row.toProductId === "beer"
    );
    expect(beer).toEqual({
      fromProductId: "burger",
      toProductId: "beer",
      impressions: 2,
      accepts: 1,
    });
  });

  it("skips sessions without anchor product", () => {
    expect(
      aggregateSessionPairStats([
        { productsRecommended: ["beer"], productsAdded: [] },
      ])
    ).toEqual([]);
  });

  it("computes accept rate and suggested weight", () => {
    expect(acceptRate(4, 1)).toBe(0.25);
    expect(suggestedWeightFromAcceptRate(0.25)).toBe(0.25);
  });

  it("enforces minimum threshold", () => {
    expect(
      meetsLearnedEdgeThreshold({
        impressions: 3,
        acceptRate: 0.2,
        minImpressions: 3,
        minAcceptRate: 0.15,
      })
    ).toBe(true);

    expect(
      meetsLearnedEdgeThreshold({
        impressions: 2,
        acceptRate: 0.5,
        minImpressions: 3,
        minAcceptRate: 0.15,
      })
    ).toBe(false);
  });
});
