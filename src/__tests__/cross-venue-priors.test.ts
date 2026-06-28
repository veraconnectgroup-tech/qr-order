import { describe, expect, it } from "vitest";
import {
  applyCrossVenuePrepFallback,
  computeCrossVenuePriors,
  crossVenueBlendWeight,
  crossVenueUsesFallback,
  findCrossVenueBasketPairs,
  findCrossVenueSubstitutionAwareness,
  localBlendWeight,
  mergeWithGlobalPriors,
  resolveCrossVenueDessertDelay,
} from "@/lib/denis/config/cross-venue-priors";
import { computeCrossVenuePriors as learningReexport } from "@/lib/denis/learning/cross-venue-priors";
import {
  locationPrepTimePriorsFromJson,
  resolvePrepTimeEstimate,
} from "@/lib/denis/config/prep-time-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";

const ORG = "org-1";
const LOC_A = "loc-a";
const LOC_B = "loc-b";
const LOC_C = "loc-c";

function rhythmWithKitchenPrep(p50: number, samples: number): LocationRhythmPriorsJson {
  return {
    version: 1,
    slots: {},
    prepTime: {
      version: 1,
      byProduct: {},
      byStation: {
        kitchen: {
          p50,
          p90: Math.round(p50 * 1.4),
          samples,
          rushMultiplier: 1.4,
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  };
}

function rhythmWithDessertDelay(minutes: number, samples: number): LocationRhythmPriorsJson {
  return {
    version: 1,
    slots: {
      "1-19": {
        sampleSessions: samples,
        sessionDurationP50Min: 45,
        dessertDelayP50Min: minutes,
        revenueEma: null,
        topProducts: [],
        servicePeriod: "dinner",
      },
    },
    prepTime: rhythmWithKitchenPrep(18, samples).prepTime,
  };
}

describe("cross-venue-priors L1 (Prompt 48)", () => {
  it("aggregates kitchen prep from 3 sibling locations", () => {
    const priors = computeCrossVenuePriors(ORG, [
      { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
      { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      { locationId: LOC_C, priors: rhythmWithKitchenPrep(21, 60) },
    ]);

    expect(learningReexport(ORG, [
      { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
      { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      { locationId: LOC_C, priors: rhythmWithKitchenPrep(21, 60) },
    ])).toEqual(priors);

    const kitchen = priors.find(
      (row) =>
        row.metric === "avg_prep_minutes" && row.productCategory === "kitchen"
    );
    expect(kitchen).toMatchObject({
      sampleLocations: 3,
      value: 18,
    });
  });

  it("new restaurant 0 sessions → 80% cross-venue weight active", () => {
    expect(crossVenueBlendWeight(0)).toBe(0.8);
    expect(localBlendWeight(0)).toBe(0.2);
    expect(crossVenueUsesFallback(0)).toBe(true);

    const crossPriors = computeCrossVenuePriors(ORG, [
      { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
      { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      { locationId: LOC_C, priors: rhythmWithKitchenPrep(21, 60) },
    ]);

    const blended = applyCrossVenuePrepFallback({
      localPriors: { version: 1, slots: {} },
      crossPriors,
      completedSessions: 0,
    });

    const prep = locationPrepTimePriorsFromJson(blended.prepTime!);
    const estimate = resolvePrepTimeEstimate(
      prep,
      [{ productId: "burger-1", station: "kitchen" }],
      false
    );

    expect(estimate.etaMinutes).toBe(18);
    expect(estimate.confidence).toBe("low");
  });

  it("200+ sessions → local only (0% cross-venue)", () => {
    const crossPriors = computeCrossVenuePriors(ORG, [
      { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
      { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      { locationId: LOC_C, priors: rhythmWithKitchenPrep(21, 60) },
    ]);

    const local = rhythmWithKitchenPrep(12, 300);
    const blended = applyCrossVenuePrepFallback({
      localPriors: local,
      crossPriors,
      completedSessions: 250,
    });

    expect(blended.prepTime?.byStation?.kitchen?.p50).toBe(12);
    expect(crossVenueBlendWeight(250)).toBe(0);
    expect(crossVenueUsesFallback(250)).toBe(false);
  });

  it("50-200 sessions → linear blend between cross and local", () => {
    expect(crossVenueBlendWeight(50)).toBe(0.8);
    expect(crossVenueBlendWeight(125)).toBe(0.4);
    expect(crossVenueBlendWeight(199)).toBeCloseTo(0.005, 2);
  });

  it("blends local and cross-venue prep for sparse locations", () => {
    const crossPriors = computeCrossVenuePriors(ORG, [
      { locationId: LOC_A, priors: rhythmWithKitchenPrep(20, 80) },
      { locationId: LOC_B, priors: rhythmWithKitchenPrep(20, 80) },
      { locationId: LOC_C, priors: rhythmWithKitchenPrep(20, 80) },
    ]);

    const blended = applyCrossVenuePrepFallback({
      localPriors: rhythmWithKitchenPrep(10, 5),
      crossPriors,
      completedSessions: 25,
    });

    const p50 = blended.prepTime?.byStation?.kitchen?.p50;
    expect(p50).toBe(18);
  });

  it("falls back to global industry priors when org has no siblings", () => {
    const priors = mergeWithGlobalPriors([], "casual");
    expect(findCrossVenueBasketPairs(priors, "burger")[0]?.value).toBe(
      "Burger + Beer"
    );
    expect(findCrossVenueBasketPairs(priors, "pasta")[0]?.value).toBe(
      "Pasta + Wine"
    );
    expect(findCrossVenueSubstitutionAwareness(priors, "DE")).toContain(
      "glutenfrei"
    );
    expect(resolveCrossVenueDessertDelay(priors, 20)).toBe(15);
  });

  it("aggregates dessert nudge timing from siblings", () => {
    const priors = computeCrossVenuePriors(ORG, [
      {
        locationId: LOC_A,
        priors: rhythmWithDessertDelay(12, 40),
        venueType: "casual",
      },
      {
        locationId: LOC_B,
        priors: rhythmWithDessertDelay(15, 50),
        venueType: "casual",
      },
      {
        locationId: LOC_C,
        priors: rhythmWithDessertDelay(18, 60),
        venueType: "casual",
      },
    ]);

    const dessert = priors.find(
      (row) => row.metric === "dessert_nudge_minutes"
    );
    expect(dessert?.value).toBe(15);
  });

  it("filters priors by similar venue type when enough siblings match", () => {
    const priors = computeCrossVenuePriors(
      ORG,
      [
        {
          locationId: LOC_A,
          priors: rhythmWithKitchenPrep(10, 80),
          venueType: "cafe",
        },
        {
          locationId: LOC_B,
          priors: rhythmWithKitchenPrep(11, 80),
          venueType: "cafe",
        },
        {
          locationId: LOC_C,
          priors: rhythmWithKitchenPrep(12, 80),
          venueType: "cafe",
        },
        {
          locationId: "loc-bar",
          priors: rhythmWithKitchenPrep(30, 80),
          venueType: "bar",
        },
      ],
      { targetVenueType: "cafe" }
    );

    const kitchen = priors.find(
      (row) =>
        row.metric === "avg_prep_minutes" && row.productCategory === "kitchen"
    );
    expect(kitchen?.value).toBe(11);
  });

  it("requires at least 3 locations for org aggregation (global still available)", () => {
    expect(
      computeCrossVenuePriors(ORG, [
        { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
        { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      ])
    ).not.toEqual([]);
    expect(
      computeCrossVenuePriors(ORG, [
        { locationId: LOC_A, priors: rhythmWithKitchenPrep(15, 80) },
        { locationId: LOC_B, priors: rhythmWithKitchenPrep(18, 100) },
      ]).some((row) => row.sampleLocations >= 3)
    ).toBe(false);
  });
});
