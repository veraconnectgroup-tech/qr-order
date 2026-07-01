import { describe, expect, it } from "vitest";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { retrieveVenueRhythmEvidence } from "@/lib/denis/cognition/context/retrievers/venue-rhythm-evidence";
import { buildWelcomeMessage } from "@/lib/denis/cognition/proactive/proactive-message-builders";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { applySessionCompletedToRhythmPriors } from "@/lib/commerce/projections/rollup-venue-rhythm-priors";
import {
  buildServicePeriodGreeting,
  buildStaffingSuggestion,
  emptyLocationRhythmPriors,
  resolveRhythmBehaviorDirectives,
  resolveRhythmPriors,
  rhythmSlotKey,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import {
  deriveTrajectoryFromFloor,
  ewmaRemainingMinutes,
  formatTurnoverRemainingHint,
  predictTableTurnover,
  shouldSuggestBillForTurnover,
} from "@/lib/denis/intelligence/table-turnover";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import type { TableSessionState } from "@/lib/denis/loop/types";

const NOW_FRI_20 = new Date("2026-06-26T18:00:00.000Z"); // Fri 20:00 Europe/Berlin
const NOW_TUE_15 = new Date("2026-06-02T13:00:00.000Z"); // Tue 15:00 Europe/Berlin
const NOW_SAT_12 = new Date("2026-06-27T10:00:00.000Z"); // Sat 12:00 Europe/Berlin

function buildFridayRushPriors(): LocationRhythmPriorsJson {
  let priors = emptyLocationRhythmPriors();
  for (let hour = 19; hour <= 22; hour += 1) {
    const iterations = hour === 20 ? 16 : 4;
    for (let i = 0; i < iterations; i += 1) {
      priors = applySessionCompletedToRhythmPriors(priors, {
        slotKey: rhythmSlotKey(5, hour),
        localDow: 5,
        localHour: hour,
        durationMin: 55,
        dessertDelayMin: 18,
        revenue: 120,
        topProducts: [
          { productId: "steak", name: "Steak", count: 1 },
          { productId: "pils", name: "Pilsner", count: 1 },
          { productId: "tira", name: "Tiramisu", count: 1 },
        ],
        servicePeriod: "dinner",
      });
    }
  }
  return priors;
}

function buildSlowTuesdayPriors(): LocationRhythmPriorsJson {
  let priors = emptyLocationRhythmPriors();
  priors = applySessionCompletedToRhythmPriors(priors, {
    slotKey: rhythmSlotKey(2, 15),
    localDow: 2,
    localHour: 15,
    durationMin: 40,
    dessertDelayMin: 20,
    revenue: 45,
    topProducts: [],
    servicePeriod: "lunch",
  });
  return priors;
}

function buildSaturdayBrunchPriors(): LocationRhythmPriorsJson {
  let priors = emptyLocationRhythmPriors();
  for (let i = 0; i < 6; i += 1) {
    priors = applySessionCompletedToRhythmPriors(priors, {
      slotKey: rhythmSlotKey(6, 12),
      localDow: 6,
      localHour: 12,
      durationMin: 48,
      dessertDelayMin: 16,
      revenue: 70,
      topProducts: [{ productId: "eggs", name: "Eggs Benedict", count: 1 }],
      servicePeriod: "lunch",
    });
  }
  return priors;
}

function baseState(): TableSessionState {
  return {
    table: { id: "t5", name: "Sto 5", token: "tok" },
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
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("rhythm priors by slot (Prompt 50)", () => {
  const config = {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    rhythm: {
      ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
      enabled: true,
      mode: "shadow" as const,
      minSampleSessions: 4,
    },
  };

  it("Friday 20:00 → rush, skip upsell, short replies", () => {
    const rhythm = resolveRhythmPriors({
      config,
      priors: buildFridayRushPriors(),
      now: NOW_FRI_20,
      timezone: "Europe/Berlin",
    });

    expect(rhythm.currentSlotStress).toBe("rush");
    expect(rhythm.behaviorDirectives?.skipUpsell).toBe(true);
    expect(rhythm.behaviorDirectives?.shortenReplies).toBe(true);
    expect(rhythm.topProductSummaries.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Steak", "Pilsner", "Tiramisu"])
    );
  });

  it("Tuesday 15:00 → slow, full upsell, chatty", () => {
    const rhythm = resolveRhythmPriors({
      config,
      priors: buildSlowTuesdayPriors(),
      now: NOW_TUE_15,
      timezone: "Europe/Berlin",
    });

    expect(rhythm.currentSlotStress).toBe("low");
    expect(rhythm.behaviorDirectives?.upsellLevel).toBe("full");
    expect(rhythm.behaviorDirectives?.conversationalTone).toBe("warm_chatty");
  });

  it("Saturday 12:00 → balanced brunch", () => {
    const rhythm = resolveRhythmPriors({
      config,
      priors: buildSaturdayBrunchPriors(),
      now: NOW_SAT_12,
      timezone: "Europe/Berlin",
    });

    expect(rhythm.servicePeriod).toBe("lunch");
    expect(rhythm.behaviorDirectives?.conversationalTone).toBe("balanced");
    expect(rhythm.behaviorDirectives?.skipUpsell).toBe(false);
  });

  it("builds staffing suggestion for Friday evening", () => {
    const priors = buildFridayRushPriors();
    const hint = buildStaffingSuggestion({
      priors,
      dow: 5,
      hourFrom: 19,
      hourTo: 22,
      targetSessionsPerWaiter: 12,
    });
    expect(hint).toMatch(/Petak 19-22/);
    expect(hint).toMatch(/konobara/);
  });
});

describe("service period greetings", () => {
  it("breakfast → kafa", () => {
    expect(buildServicePeriodGreeting({ servicePeriod: "breakfast" })).toMatch(
      /Kafa|kafa/i
    );
  });

  it("lunch → daily special", () => {
    expect(
      buildServicePeriodGreeting({
        servicePeriod: "lunch",
        todaySpecial: "Riblja čorba",
      })
    ).toMatch(/Riblja čorba/);
  });

  it("dinner → aperitiv", () => {
    expect(buildServicePeriodGreeting({ servicePeriod: "dinner" })).toMatch(
      /Aperitiv|aperitif/i
    );
  });

  it("late → bar open until 01:00", () => {
    expect(buildServicePeriodGreeting({ servicePeriod: "late" })).toMatch(
      /01:00/
    );
  });

  it("appears in buildSystemPrompt", () => {
    const prompt = buildSystemPrompt({
      orgName: "Skyline",
      menuText: "Menu",
      language: "sr",
      servicePeriodGreeting: buildServicePeriodGreeting({
        servicePeriod: "breakfast",
      }),
    });
    expect(prompt).toContain("SERVICE PERIOD");
    expect(prompt).toMatch(/Kafa|kafa/i);
  });

  it("welcome message uses service period", () => {
    const msg = buildWelcomeMessage(
      "Skyline",
      "sr",
      null,
      "fallback",
      null,
      "breakfast"
    );
    expect(msg).toMatch(/Kafa|kafa|jutro/i);
  });
});

describe("table turnover EWMA (Prompt 50)", () => {
  const NOW = Date.parse("2026-06-27T14:00:00.000Z");

  it("75 min avg at 60 min elapsed → ~15 min remaining", () => {
    expect(ewmaRemainingMinutes(75, 60)).toBe(15);

    const trajectory = deriveTrajectoryFromFloor({
      seatedMinutes: 60,
      openOrderCount: 1,
      allOrdersDelivered: false,
      idleMinutes: 2,
      guestWaitMinutes: null,
      minutesSinceLastDelivery: null,
    });

    const prediction = predictTableTurnover({
      tableId: "t5",
      tableName: "Sto 5",
      trajectory,
      sessionStartedAt: new Date(NOW - 60 * 60_000).toISOString(),
      ordersFacts: [],
      historicalAvgMinutes: 75,
      now: NOW,
    });

    expect(prediction).not.toBeNull();
    expect(prediction!.estimatedRemainingMin).toBe(15);
    expect(formatTurnoverRemainingHint(prediction!)).toMatch(/Sto 5/);
    expect(formatTurnoverRemainingHint(prediction!)).toMatch(/15 min/);
  });

  it("rush mode suggests bill when turnover overrun", () => {
    const prediction = predictTableTurnover({
      tableId: "t5",
      tableName: "Sto 5",
      trajectory: deriveTrajectoryFromFloor({
        seatedMinutes: 50,
        openOrderCount: 0,
        allOrdersDelivered: true,
        idleMinutes: 20,
        guestWaitMinutes: null,
        minutesSinceLastDelivery: 25,
      }),
      sessionStartedAt: new Date(NOW - 50 * 60_000).toISOString(),
      ordersFacts: [],
      historicalAvgMinutes: 75,
      now: NOW,
    })!;

    expect(
      shouldSuggestBillForTurnover({ prediction, isRush: true })
    ).toBe(true);
    expect(
      shouldSuggestBillForTurnover({ prediction, isRush: false })
    ).toBe(false);
  });

  it("proactive ranks bill_prompt under rush + long sitting", () => {
    const candidates = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [
        {
          id: "o1",
          status: "delivered",
          created_at: new Date(Date.now() - 40 * 60_000).toISOString(),
          delivered_at: new Date(Date.now() - 30 * 60_000).toISOString(),
          order_items: [
            {
              product_id: "steak",
              product_name: "Steak",
              unit_price: 45,
              quantity: 1,
              menu_section: "food",
            },
          ],
        },
      ],
      payload: {
        idleMinutes: 20,
        sessionPhase: "eating",
      },
      messages: {
        browse: "",
        dessert: "",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "Hoćete račun?",
        orderDelay: "",
        popularityPair: "",
      },
    });

    expect(candidates.some((c) => c.nudge.kind === "bill_prompt")).toBe(true);
  });
});

describe("rhythm wired into situation pack + beliefs", () => {
  it("VENUE RHYTHM block includes behavior and top products", () => {
    const rhythm = resolveRhythmPriors({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "shadow",
          minSampleSessions: 4,
        },
      },
      priors: buildFridayRushPriors(),
      now: NOW_FRI_20,
      timezone: "Europe/Berlin",
    });

    const evidence = retrieveVenueRhythmEvidence(rhythm);
    expect(evidence).toContain("typically rush");
    expect(evidence).toContain("Steak");
    expect(evidence).toMatch(/no upsell|keep replies short/i);

    const beliefs = compileBeliefs({
      state: baseState(),
      guestMessage: "",
      rhythm,
    });
    expect(getBeliefValue(beliefs, CORE_BELIEF_KEYS.venueCurrentSlotStress)).toBe(
      "rush"
    );
    expect(rhythm.behaviorDirectives?.skipUpsell).toBe(true);

    const pack = buildSituationPack({
      state: baseState(),
      beliefs,
      rhythm,
    });
    expect(pack).toContain("VENUE RHYTHM:");
  });

  it("resolveRhythmBehaviorDirectives maps stress bands", () => {
    expect(resolveRhythmBehaviorDirectives("rush", "dinner").skipUpsell).toBe(
      true
    );
    expect(resolveRhythmBehaviorDirectives("low", "lunch").upsellLevel).toBe(
      "full"
    );
    expect(
      resolveRhythmBehaviorDirectives("normal", "lunch").conversationalTone
    ).toBe("balanced");
  });
});
