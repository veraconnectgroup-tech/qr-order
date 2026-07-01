import { describe, expect, it } from "vitest";
import { collectPrepTimeFacts } from "@/lib/commerce/projections/collect-prep-time-facts";
import { applyPrepTimeFactsToPriors } from "@/lib/commerce/projections/rollup-prep-time-priors";
import {
  emptyLocationPrepTimePriorsJson,
  locationPrepTimePriorsFromJson,
  resolvePrepTimeEstimate,
} from "@/lib/denis/config/prep-time-priors";
import { emptyLocationRhythmPriors } from "@/lib/denis/config/resolve-rhythm-priors";

function priorsWithSamples(
  productId: string,
  samples: number,
  p50: number,
  stationP50?: number
) {
  const prepTime = emptyLocationPrepTimePriorsJson();
  prepTime.byProduct[productId] = {
    productId,
    p50Minutes: p50,
    p90Minutes: p50 + 4,
    sampleCount: samples,
    rushMultiplier: 1.4,
  };
  if (stationP50 != null) {
    prepTime.byStation.kitchen = {
      p50: stationP50,
      p90: stationP50 + 3,
      samples: 12,
      rushMultiplier: 1.4,
    };
  }
  return locationPrepTimePriorsFromJson(prepTime);
}

describe("collectPrepTimeFacts", () => {
  it("derives prep minutes from preparing_at to delivered_at", () => {
    const facts = collectPrepTimeFacts(
      {
        id: "o1",
        status: "delivered",
        created_at: "2026-05-27T11:00:00.000Z",
        accepted_at: "2026-05-27T11:05:00.000Z",
        preparing_at: "2026-05-27T11:10:00.000Z",
        delivered_at: "2026-05-27T11:24:00.000Z",
        order_items: [
          {
            product_id: "burger-id",
            product_name: "Burger",
            menu_section: "food",
          },
        ],
      },
      {
        locationId: "loc-1",
        timezone: "Europe/Berlin",
      }
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]?.prepMinutes).toBe(14);
    expect(facts[0]?.station).toBe("kitchen");
  });
});

describe("resolvePrepTimeEstimate", () => {
  it("returns high confidence when product has >= 5 samples", () => {
    const priors = priorsWithSamples("burger-id", 15, 14);
    const estimate = resolvePrepTimeEstimate(
      priors,
      [{ productId: "burger-id", station: "kitchen" }],
      false
    );

    expect(estimate).toEqual({
      etaMinutes: 14,
      confidence: "high",
    });
  });

  it("uses station average with low confidence when product samples are sparse", () => {
    const priors = priorsWithSamples("new-item", 2, 9, 12);
    const estimate = resolvePrepTimeEstimate(
      priors,
      [{ productId: "new-item", station: "kitchen" }],
      false
    );

    expect(estimate).toEqual({
      etaMinutes: 12,
      confidence: "low",
    });
  });

  it("returns none when no priors exist", () => {
    expect(
      resolvePrepTimeEstimate(
        null,
        [{ productId: "x", station: "kitchen" }],
        false
      )
    ).toEqual({ etaMinutes: null, confidence: "none" });
  });

  it("applies rush multiplier for high-confidence products", () => {
    const priors = priorsWithSamples("burger-id", 10, 10);
    const estimate = resolvePrepTimeEstimate(
      priors,
      [{ productId: "burger-id", station: "kitchen" }],
      true
    );

    expect(estimate.etaMinutes).toBe(14);
    expect(estimate.confidence).toBe("high");
  });

  it("uses max ETA across mixed station items", () => {
    const prepTime = emptyLocationPrepTimePriorsJson();
    prepTime.byProduct["burger-id"] = {
      productId: "burger-id",
      p50Minutes: 14,
      p90Minutes: 18,
      sampleCount: 8,
      rushMultiplier: 1.4,
    };
    prepTime.byProduct["pilsner-id"] = {
      productId: "pilsner-id",
      p50Minutes: 3,
      p90Minutes: 5,
      sampleCount: 20,
      rushMultiplier: 1.2,
    };
    const priors = locationPrepTimePriorsFromJson(prepTime);

    const estimate = resolvePrepTimeEstimate(
      priors,
      [
        { productId: "pilsner-id", station: "bar" },
        { productId: "burger-id", station: "kitchen" },
      ],
      false
    );

    expect(estimate).toEqual({
      etaMinutes: 14,
      confidence: "high",
    });
  });
});

describe("applyPrepTimeFactsToPriors", () => {
  it("incrementally updates prep time priors inside rhythm JSON", () => {
    const updated = applyPrepTimeFactsToPriors(emptyLocationRhythmPriors(), [
      {
        locationId: "loc-1",
        productId: "burger-id",
        productName: "Burger",
        menuSection: "food",
        station: "kitchen",
        prepMinutes: 14,
        dayOfWeek: 5,
        hour: 20,
        isRush: true,
      },
    ]);

    expect(updated.prepTime?.byProduct["burger-id"]?.sampleCount).toBe(1);
    expect(updated.prepTime?.byProduct["burger-id"]?.p50Minutes).toBe(14);
    expect(updated.prepTime?.byStation.kitchen?.samples).toBe(1);
  });
});
