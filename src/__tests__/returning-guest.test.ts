import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { aggregateReturningGuestStats } from "@/lib/admin/denis-shift-report";
import { deriveContextualChips } from "@/lib/denis/loop/derive-contextual-chips";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import {
  buildSameAgainChipLabel,
  returnGuestHasPastOrders,
  shouldEmitReturnGuestWelcome,
  shouldSuppressAllergyPromptChip,
} from "@/lib/denis/platform/returning-guest";
import { buildReturnGuestWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-welcome-message";
import { sameAgainQuickReplyLabels } from "@/lib/denis/learning/guest-memory/same-again-chips";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate/build-narration-facts";
import { resolveTurnQuickReplies } from "@/lib/denis/runtime/narrate/build-turn-quick-replies";
import { resolveTurnAllergyContext } from "@/lib/denis/cognition/safety/resolve-turn-allergy-context";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { buildDailyReport, formatDailyReportDigest } from "@/lib/admin/build-daily-report";

import type { CartView } from "@/lib/denis/loop/view-types";

const emptyCartView: CartView = {
  aiItemCount: 0,
  manualItemCount: 0,
  visibleItemCount: 0,
  hasConflict: false,
  conflictPrompt: null,
  revision: 0,
};

const PIZZA_ID = "11111111-1111-4111-8111-111111111111";

const configWithReturningGuest = {
  ...CONCIERGE_PLATFORM_DEFAULTS,
  memory: {
    ...CONCIERGE_PLATFORM_DEFAULTS.memory,
    returnGuestEnabled: true,
  },
};

const PIZZA_CATALOG: MenuRagCatalog = {
  [PIZZA_ID]: {
    id: PIZZA_ID,
    name: "Pizza",
    price: 10,
    imageUrl: null,
    menuSection: "food",
    allergens: ["gluten"],
    taxRate: 19,
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  },
};

function returningMemory(
  overrides: Parameters<typeof emptyGuestMemoryProjection>[0] = {}
) {
  return emptyGuestMemoryProjection({
    hasMemoryConsent: true,
    visitCount: 3,
    lastVisitItemNames: ["Lav", "Mešano"],
    favoriteItems: ["Lav", "Mešano"],
    favoriteProductIds: ["beer-lav", "food-mesano"],
    allergyLabels: [],
    preferredLanguage: "sr",
    language: "sr",
    ...overrides,
  });
}

describe("ADR-043 S11 — returning guest recognition", () => {
  it("shouldEmitReturnGuestWelcome requires enabled config, consent, and past orders", () => {
    const config = configWithReturningGuest;
    const memory = returningMemory();

    expect(
      shouldEmitReturnGuestWelcome({
        config,
        memory,
        flowNodeId: "welcome",
        topGoal: "GUEST_SEATED",
      })
    ).toBe(true);

    expect(
      shouldEmitReturnGuestWelcome({
        config: {
          ...config,
          memory: {
            ...CONCIERGE_PLATFORM_DEFAULTS.memory,
            returnGuestEnabled: false,
          },
        },
        memory,
        flowNodeId: "welcome",
        topGoal: "GUEST_SEATED",
      })
    ).toBe(false);

    expect(
      shouldEmitReturnGuestWelcome({
        config,
        memory: returningMemory({ visitCount: 1, lastVisitItemNames: [] }),
        flowNodeId: "welcome",
        topGoal: "GUEST_SEATED",
      })
    ).toBe(false);

    expect(
      shouldEmitReturnGuestWelcome({
        config,
        memory: returningMemory({ hasMemoryConsent: false }),
        flowNodeId: "welcome",
        topGoal: "GUEST_SEATED",
      })
    ).toBe(false);
  });

  it("returning guest with past orders gets warmer welcome and named same-again chip", () => {
    const welcome = buildReturnGuestWelcomeMessage({
      language: "sr",
      lastVisitItems: ["Lav", "Mešano"],
      visitCount: 3,
      memory: returningMemory(),
    });
    expect(welcome).toContain("ponovo");

    expect(buildSameAgainChipLabel("sr", "Lav")).toBe("Obično — Lav?");
    expect(sameAgainQuickReplyLabels("sr", "Lav").sameAgain).toBe(
      "Obično — Lav?"
    );

    const chips = deriveContextualChips({
      mental: emptyGuestMentalModel(Date.now()),
      phase: "browsing",
      cart: emptyCartView,
      memory: returningMemory(),
      language: "sr",
      situation: null,
      hasUnpaidOrders: false,
      orderCount: 0,
    });
    expect(chips.some((chip) => chip.label.includes("Lav"))).toBe(true);
  });

  it("new guest — no welcome fact and standard browse chips", () => {
    const config = configWithReturningGuest;
    const reflexTurn = planTurnWithReflex({
      config,
      message: "",
      flowNodeId: "welcome",
      cartState: emptyCartState(),
      foodUpsellAsked: false,
    });

    const facts = buildNarrationFacts({
      config,
      language: "sr",
      reflexTurn,
      flowNodeId: "welcome",
      guestMemory: emptyGuestMemoryProjection({ visitCount: 0 }),
    });

    expect(facts.committed.returnGuestWelcome).toBeUndefined();

    const chips = deriveContextualChips({
      mental: emptyGuestMentalModel(Date.now()),
      phase: "browsing",
      cart: emptyCartView,
      memory: null,
      language: "sr",
      situation: null,
      hasUnpaidOrders: false,
      orderCount: 0,
    });
    expect(chips.some((chip) => chip.id === "chip-same-again")).toBe(false);
    expect(chips.some((chip) => chip.id === "chip-allergy")).toBe(true);
  });

  it("remembered allergy is used by guard without re-declaring in chat", async () => {
    const memory = returningMemory({ allergyLabels: ["gluten"] });
    expect(shouldSuppressAllergyPromptChip(memory)).toBe(true);

    const browseChips = deriveContextualChips({
      mental: emptyGuestMentalModel(Date.now()),
      phase: "browsing",
      cart: emptyCartView,
      memory,
      language: "sr",
      situation: null,
      hasUnpaidOrders: false,
      orderCount: 0,
    });
    expect(browseChips.some((chip) => chip.id === "chip-allergy")).toBe(false);

    const allergyCtx = await resolveTurnAllergyContext({
      locationId: "loc-1",
      cartLines: [
        {
          productId: PIZZA_ID,
          productName: "Pizza",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 10,
        },
      ],
      guestMemory: memory,
      guestMessage: "",
      language: "sr",
      catalog: PIZZA_CATALOG,
    });

    expect(allergyCtx.knownAllergieLabels).toContain("gluten");
    expect(allergyCtx.guard.safe).toBe(false);
  });

  it("guest memory token is stable opaque hash per location+device", () => {
    const a = deriveGuestMemoryToken("loc-1", "device-fp-abc");
    const b = deriveGuestMemoryToken("loc-1", "device-fp-abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returnGuestHasPastOrders false when only visit count without items", () => {
    expect(
      returnGuestHasPastOrders(
        returningMemory({
          visitCount: 2,
          lastVisitItemNames: [],
          favoriteProductIds: [],
          favoriteItems: [],
        })
      )
    ).toBe(false);
  });

  it("welcome quick replies include top item from allowed mentions", () => {
    const labels = sameAgainQuickReplyLabels("en", "Burger");
    const chips = resolveTurnQuickReplies({
      reflexTurn: planTurnWithReflex({
        config: CONCIERGE_PLATFORM_DEFAULTS,
        message: "",
        flowNodeId: "welcome",
        cartState: emptyCartState(),
        foodUpsellAsked: false,
      }),
      facts: {
        persona: { name: "Denis", tone: "warm_short", maxWords: 45 },
        language: "en",
        goal: "GUEST_SEATED",
        committed: {
          returnGuestWelcome: "Welcome back! Last time: Burger — again?",
        },
        forbidden: [],
        allowedMentions: ["Burger"],
      },
      narration: {
        message: "Welcome back!",
        tier: "template",
        lintPassed: true,
        issues: [],
        usedFallback: true,
      },
      language: "en",
    });

    expect(chips[0]).toBe(labels.sameAgain);
    expect(chips[0]).toContain("Burger");
  });
});

describe("aggregateReturningGuestStats (daily report S11)", () => {
  it("computes recognized count and spend vs venue average", () => {
    const stats = aggregateReturningGuestStats({
      sessions: [
        { id: "s1", guest_token: "token-return" },
        { id: "s2", guest_token: "token-new" },
      ],
      orders: [
        { session_id: "s1", total: 3000 },
        { session_id: "s1", total: 1500 },
        { session_id: "s2", total: 1000 },
      ],
      visitCountByToken: {
        "token-return": 4,
        "token-new": 1,
      },
    });

    expect(stats.recognizedToday).toBe(1);
    expect(stats.returningSpendTotal).toBe(4500);
    expect(stats.returningAvgSpend).toBe(4500);
    expect(stats.venueAvgSpend).toBeCloseTo(5500 / 3);
  });

  it("surfaces in daily report Denis shift digest", () => {
    const report = buildDailyReport({
      date: "2026-07-01",
      venueName: "Test",
      weekdayLabel: "Utorak",
      currencyLabel: "RSD",
      orders: [],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 0,
      revenueLastWeekSameDay: 0,
      prepTimeAvgMinutes: 14,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 2,
      newGuestSessions: 5,
      denisShift: {
        stationQuestions: [],
        staffNotifications: [],
        waiterCalls: [],
        stationStates: [],
        tableNames: {},
        kitchenFallbackPrepMinutes: 14,
        returningGuests: {
          recognizedToday: 2,
          returningSpendTotal: 8000,
          returningAvgSpend: 4000,
          venueAvgSpend: 2500,
        },
      },
    });

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("Stalni gosti: 2 prepoznato");
    expect(digest.text).toContain("4.000");
    expect(digest.html).toContain("Stalni gosti");
  });
});
