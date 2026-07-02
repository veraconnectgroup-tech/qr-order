import { describe, expect, it } from "vitest";
import {
  buildReturnGuestWelcomeMessage,
  sameAgainQuickReplyLabels,
} from "@/lib/denis/learning";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate";
import { resolveTurnQuickReplies } from "@/lib/denis/runtime/narrate/build-turn-quick-replies";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";

describe("guest memory M17", () => {
  it("builds welcome message for returning guests", () => {
    expect(
      buildReturnGuestWelcomeMessage({
        language: "en",
        lastVisitItems: ["Burger", "Craft beer"],
        visitCount: 2,
      })
    ).toContain("Burger, Craft beer");

    expect(
      buildReturnGuestWelcomeMessage({
        language: "sr",
        lastVisitItems: [],
        visitCount: 1,
      })
    ).toBeNull();
  });

  it("derives stable opaque guest tokens", () => {
    const a = deriveGuestMemoryToken("loc-1", "fingerprint-abc");
    const b = deriveGuestMemoryToken("loc-1", "fingerprint-abc");
    const c = deriveGuestMemoryToken("loc-2", "fingerprint-abc");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("adds return-guest welcome to narration facts on welcome node", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      memory: {
        ...CONCIERGE_PLATFORM_DEFAULTS.memory,
        returnGuestEnabled: true,
      },
    };
    const reflexTurn = planTurnWithReflex({
      config,
      message: "",
      flowNodeId: "welcome",
      cartState: emptyCartState(),
      foodUpsellAsked: false,
    });

    const facts = buildNarrationFacts({
      config,
      language: "en",
      reflexTurn,
      flowNodeId: "welcome",
      guestMemory: emptyGuestMemoryProjection({
        preferredLanguage: "en",
        language: "en",
        visitCount: 2,
        hasMemoryConsent: true,
        lastVisitItemNames: ["Burger", "IPA"],
        favoriteItems: ["Burger", "IPA"],
        lastVisitAt: new Date().toISOString(),
        lastVisit: new Date().toISOString(),
      }),
    });

    expect(facts.committed.returnGuestWelcome).toContain("Burger, IPA");
  });

  it("offers same-again T0 chips for return-guest welcome", () => {
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
        message: "Welcome back! Last time: Burger — again?",
        tier: "template",
        lintPassed: true,
        issues: [],
        usedFallback: true,
      },
      language: "en",
    });

    expect(chips).toEqual([labels.sameAgain, labels.somethingElse]);
  });
});
