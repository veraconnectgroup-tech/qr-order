import { describe, expect, it } from "vitest";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { formatGuestRelationshipActiveMemoryBlock } from "@/lib/denis/cognition/conversation/active-memory";
import { retrieveGuestIntelEvidence } from "@/lib/denis/cognition/context/retrievers/guest-intel-evidence";
import {
  appendRelationshipVisit,
  computeBehavioralPatterns,
  emptyGuestRelationshipSnapshot,
  refreshRelationshipSnapshot,
} from "@/lib/denis/learning/guest-memory/build-relationship-timeline";
import { buildOccasionAwareWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-occasion-aware-welcome";
import { buildRelationshipWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-relationship-welcome";
import { buildReturnGuestWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-welcome-message";
import {
  detectPreferenceEvolution,
  formatPreferenceEvolutionHint,
  preferenceEvolutionChanged,
} from "@/lib/denis/learning/guest-memory/detect-preference-evolution";
import { detectGuestOccasions } from "@/lib/denis/learning/guest-memory/detect-guest-occasions";
import {
  formatGuestRelationshipBlock,
  guestMemoryPersonalizationAllowed,
  shouldOfferDessert,
  shouldOfferStarter,
} from "@/lib/denis/platform/guest-memory-format";
import {
  emptyGuestMemoryProjection,
  type GuestMemoryProjection,
} from "@/lib/denis/platform/guest-memory-types";

function consentedGuest(
  overrides: Partial<GuestMemoryProjection> = {}
): GuestMemoryProjection {
  return emptyGuestMemoryProjection({
    hasMemoryConsent: true,
    consentScopes: ["allergies", "favorites", "language", "relationship"],
    ...overrides,
  });
}

describe("guest relationship engine", () => {
  it("welcomes on 3rd visit with dobro dosli ponovo", () => {
    const welcome = buildRelationshipWelcomeMessage({
      language: "sr",
      visitCount: 3,
      memory: consentedGuest({ visitCount: 3 }),
    });
    expect(welcome).toContain("Dobro došli ponovo");
  });

  it("buildReturnGuestWelcomeMessage uses relationship welcome for visit 3", () => {
    const welcome = buildReturnGuestWelcomeMessage({
      language: "sr",
      lastVisitItems: ["Burger"],
      visitCount: 3,
      memory: consentedGuest({ visitCount: 3 }),
    });
    expect(welcome).toMatch(/Drago nam je|Dobro došli ponovo/i);
  });

  it("never offers starter when guest pattern excludes appetizers", () => {
    const memory = consentedGuest({
      visitCount: 4,
      preferredMealPattern: "main_dessert",
      relationship: refreshRelationshipSnapshot(
        {
          version: 1,
          timeline: [
            {
              visitNumber: 1,
              visitedAt: "2026-06-01T19:00:00.000Z",
              daysSincePrevious: null,
              dayOfWeek: 5,
              itemNames: ["Burger", "Tiramisu"],
              events: [],
            },
            {
              visitNumber: 2,
              visitedAt: "2026-06-08T19:00:00.000Z",
              daysSincePrevious: 7,
              dayOfWeek: 5,
              itemNames: ["Steak", "Cheesecake"],
              events: [],
            },
          ],
          behavioral: computeBehavioralPatterns({
            timeline: [],
            preferredMealPattern: "main_dessert",
          }),
          preferenceEvolution: [],
          currentPreferenceItems: ["Burger"],
          typicalPartySize: 2,
        },
        { preferredMealPattern: "main_dessert" }
      ),
    });

    memory.relationship!.behavioral.neverOrdersStarter = true;
    expect(shouldOfferStarter(memory)).toBe(false);
    expect(shouldOfferDessert(memory)).toBe(true);
  });

  it("detects preference evolution from burger to salad visits", () => {
    let snapshot = refreshRelationshipSnapshot(
      { version: 1, timeline: [], behavioral: computeBehavioralPatterns({ timeline: [] }), preferenceEvolution: [], currentPreferenceItems: [], typicalPartySize: null },
      {}
    );

    for (let visit = 1; visit <= 3; visit += 1) {
      snapshot = appendRelationshipVisit(snapshot, {
        visitedAt: `2026-0${visit}-01T19:00:00.000Z`,
        itemNames: ["Burger"],
      });
    }
    for (let visit = 4; visit <= 5; visit += 1) {
      snapshot = appendRelationshipVisit(snapshot, {
        visitedAt: `2026-0${visit}-08T19:00:00.000Z`,
        itemNames: ["Quinoa Salad"],
      });
    }

    const phases = detectPreferenceEvolution(snapshot.timeline);
    expect(preferenceEvolutionChanged(phases)).toBe(true);
    const hint = formatPreferenceEvolutionHint(
      phases,
      snapshot.currentPreferenceItems,
      "sr"
    );
    expect(hint).toMatch(/Burger/i);
    expect(hint).toMatch(/Salad/i);
  });

  it("returns no personalization without consent", () => {
    const memory = emptyGuestMemoryProjection({
      visitCount: 5,
      favoriteItems: ["Burger"],
      hasMemoryConsent: false,
    });

    expect(guestMemoryPersonalizationAllowed(memory)).toBe(false);
    expect(retrieveGuestIntelEvidence(memory)).toBe("");
    expect(formatGuestRelationshipBlock(memory)).toBe("");
    expect(
      buildRelationshipWelcomeMessage({
        language: "sr",
        visitCount: 3,
        memory,
      })
    ).toBeNull();
  });

  it("injects relationship block into situation pack for consented guest", () => {
    let snapshot = refreshRelationshipSnapshot(
      { version: 1, timeline: [], behavioral: computeBehavioralPatterns({ timeline: [] }), preferenceEvolution: [], currentPreferenceItems: [], typicalPartySize: 2 },
      { preferredMealPattern: "main_dessert", avgSpendCents: 2800 }
    );
    snapshot = appendRelationshipVisit(snapshot, {
      visitedAt: "2026-06-21T19:00:00.000Z",
      itemNames: ["Burger", "Pomfrit"],
      feedbackSentiment: "positive",
    });

    const memory = consentedGuest({
      visitCount: 3,
      avgSpend: 28,
      preferredMealPattern: "main_dessert",
      relationship: snapshot,
      occasions: detectGuestOccasions({
        relationship: snapshot,
        visitCount: 3,
      }),
    });

    const pack = buildSituationPack({
      beliefs: beliefGraph([]),
      guestMemory: memory,
    });

    expect(pack).toContain("GUEST RELATIONSHIP");
    expect(pack).toContain("skip_starter");

    const active = formatGuestRelationshipActiveMemoryBlock(memory);
    expect(active).toContain("prioritize_dessert");
  });

  it("detects visit milestone occasion on 10th visit", () => {
    const occasions = detectGuestOccasions({
      relationship: null,
      visitCount: 10,
    });
    expect(occasions).toContain("visit_milestone");
  });

  it("builds occasion-aware welcome for celebration party", () => {
    const relationship = refreshRelationshipSnapshot(
      emptyGuestRelationshipSnapshot(),
      { preferredMealPattern: "main_dessert" }
    );
    relationship.typicalPartySize = 2;
    const welcome = buildOccasionAwareWelcomeMessage({
      language: "sr",
      visitCount: 4,
      lastVisitItems: ["Schnitzel"],
      currentPartySize: 6,
      memory: consentedGuest({
        visitCount: 4,
        lastVisitItemNames: ["Schnitzel"],
        relationship,
      }),
    });
    expect(welcome).toMatch(/Slavite|Schnitzel/i);
  });

  it("builds recovery welcome after negative feedback", () => {
    const welcome = buildOccasionAwareWelcomeMessage({
      language: "sr",
      visitCount: 3,
      lastVisitItems: ["Burger"],
      lastFeedbackSentiment: "negative",
      memory: consentedGuest({ visitCount: 3, lastFeedbackSentiment: "negative" }),
    });
    expect(welcome).toContain("Prošli put nije bilo idealno");
  });

  it("detects date night for party of two in evening", () => {
    const occasions = detectGuestOccasions({
      relationship: null,
      visitCount: 2,
      currentPartySize: 2,
      now: new Date("2026-07-04T20:00:00.000Z"),
    });
    expect(occasions).toContain("date_night");
  });
});
