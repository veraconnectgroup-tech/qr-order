import { describe, expect, it } from "vitest";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { compileRhythmBeliefs } from "@/lib/denis/cognition/beliefs/compile-rhythm-beliefs";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { retrieveVenueRhythmEvidence } from "@/lib/denis/cognition/context/retrievers/venue-rhythm-evidence";
import {
  applyRhythmShadowAutoEnable,
} from "@/lib/denis/config/load-concierge-config";
import { RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS } from "@/lib/denis/config/count-location-completed-sessions";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  resolveRhythmPriors,
  slotStressFromRushIndex,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import type { TableSessionState } from "@/lib/denis/loop/types";

const mockPriors: LocationRhythmPriorsJson = {
  version: 1,
  slots: {
    "1:10": {
      sampleSessions: 8,
      sessionDurationP50Min: 35,
      dessertDelayP50Min: 14,
      revenueEma: 150,
      servicePeriod: "breakfast",
      topProducts: [],
    },
    "2:12": {
      sampleSessions: 10,
      sessionDurationP50Min: 40,
      dessertDelayP50Min: 15,
      revenueEma: 200,
      servicePeriod: "lunch",
      topProducts: [],
    },
    "5:20": {
      sampleSessions: 45,
      sessionDurationP50Min: 52,
      dessertDelayP50Min: 18,
      revenueEma: 420,
      servicePeriod: "dinner",
      topProducts: [
        { productId: "p1", name: "Burger", count: 38 },
        { productId: "p2", name: "Schnitzel", count: 24 },
        { productId: "p3", name: "Aperol Spritz", count: 31 },
      ],
    },
  },
  prepTime: {
    version: 1,
    byProduct: {},
    byStation: {
      kitchen: {
        p50: 16,
        p90: 24,
        samples: 120,
        rushMultiplier: 1.375,
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
};

function baseState(config = CONCIERGE_PLATFORM_DEFAULTS): TableSessionState {
  return {
    table: { id: "t1", name: "T1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: { ai: emptyCartState(), visibleLines: [] },
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [],
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "welcome",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config,
  };
}

describe("rhythm shadow auto-enable (C1)", () => {
  it("enables shadow mode after enough completed sessions", () => {
    const config = applyRhythmShadowAutoEnable(
      CONCIERGE_PLATFORM_DEFAULTS,
      RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS
    );
    expect(config.rhythm.enabled).toBe(true);
    expect(config.rhythm.mode).toBe("shadow");
  });

  it("does not override explicit enforce mode", () => {
    const config = applyRhythmShadowAutoEnable(
      {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "enforce",
        },
      },
      100
    );
    expect(config.rhythm.mode).toBe("enforce");
  });
});

describe("resolveRhythmPriors beliefs context (C1)", () => {
  it("derives rush slot stress and prep averages in shadow mode", () => {
    const rhythm = resolveRhythmPriors({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "shadow",
        },
      },
      priors: mockPriors,
      now: new Date("2026-06-26T18:00:00.000Z"),
      timezone: "Europe/Berlin",
    });

    expect(rhythm.active).toBe(true);
    expect(rhythm.applied).toBe(false);
    expect(rhythm.currentSlotStress).toBe("rush");
    expect(rhythm.typicalSessionMinutes).toBe(52);
    expect(rhythm.kitchenPrepAvgMinutes).toBe(16);
    expect(rhythm.kitchenPrepRushMinutes).toBe(22);
    expect(rhythm.topProductSummaries[0]?.name).toBe("Burger");
  });

  it("maps rush index to slot stress bands", () => {
    expect(slotStressFromRushIndex(2.1)).toBe("rush");
    expect(slotStressFromRushIndex(1.4)).toBe("busy");
    expect(slotStressFromRushIndex(0.8)).toBe("normal");
  });
});

describe("compileRhythmBeliefs (C1)", () => {
  it("adds rhythm beliefs without changing proactive behavior flags", () => {
    const rhythm = resolveRhythmPriors({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "shadow",
        },
      },
      priors: mockPriors,
      now: new Date("2026-06-26T18:00:00.000Z"),
      timezone: "Europe/Berlin",
    });

    const beliefs = compileRhythmBeliefs(rhythm);
    expect(beliefs).toHaveLength(3);

    const graph = compileBeliefs({
      state: baseState(),
      guestMessage: "",
      rhythm,
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.venueCurrentSlotStress)).toBe(
      "rush"
    );
    expect(
      getBeliefValue(graph, CORE_BELIEF_KEYS.venueTypicalSessionMinutes)
    ).toBe(52);
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.venueTopProducts)).toContain(
      "Burger (41%)"
    );
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.venueSkipUpsell)).toBe(false);
  });

  it("renders VENUE RHYTHM section in situation pack", () => {
    const rhythm = resolveRhythmPriors({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "shadow",
        },
      },
      priors: mockPriors,
      now: new Date("2026-06-26T18:00:00.000Z"),
      timezone: "Europe/Berlin",
    });

    const evidence = retrieveVenueRhythmEvidence(rhythm);
    expect(evidence).toContain("VENUE RHYTHM:");
    expect(evidence).toContain("typically rush");
    expect(evidence).toContain("Avg session: 52 min");
    expect(evidence).toContain("Kitchen prep avg: 16 min");
    expect(evidence).toContain("Popular now:");

    const pack = buildSituationPack({
      state: baseState(),
      beliefs: compileBeliefs({ state: baseState(), guestMessage: "", rhythm }),
      rhythm,
    });
    expect(pack).toContain("VENUE RHYTHM:");
  });
});
