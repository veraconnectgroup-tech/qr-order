import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildPersonalityBlock,
  buildEmotionalIntelligenceBlock,
  resolveDayPeriod,
} from "@/lib/denis/cognition/personality/personality-engine";
import {
  buildHumorGuidanceBlock,
  isHumorAllowed,
} from "@/lib/denis/cognition/personality/humor-engine";
import {
  buildCulturalSensitivityBlock,
  resolveCulturalProfile,
} from "@/lib/denis/cognition/personality/cultural-sensitivity";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";

const BASE_MENTAL: GuestMentalModel = {
  ...emptyGuestMentalModel(),
  confidence: 0.8,
  hash: "test",
  intent: "exploring",
  receptiveness: "open",
  engagement: {
    guestTurns: 2,
    avgMsgLen: 20,
    guestInitiated: true,
    nudgeResponseRate: 0.5,
  },
  nudgeBudget: { remaining: 2, max: 3, cooldownUntil: null },
  priceAffinity: "mid",
  affect: {
    frustration: { level: "none", signals: [] },
    sentiment: { score: 0.5, lastSignals: [] },
  },
};

describe("personality-engine", () => {
  it("formal tone + DE language → Siezen cultural block", () => {
    const block = buildPersonalityBlock({
      persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "formal" },
      orgName: "Test",
      language: "de",
    });
    expect(block).toContain("VENUE TONE (formal)");
    expect(block).toContain("Siezen");
  });

  it("formal tone + SR guest → respectful warm cultural block", () => {
    const block = buildPersonalityBlock({
      persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "formal" },
      orgName: "Test",
      language: "sr",
    });
    expect(block).toContain("VENUE TONE (formal)");
    expect(buildCulturalSensitivityBlock(resolveCulturalProfile("sr"))).toContain(
      "Vi-formal"
    );
  });

  it("playful_luxury → appropriate humor with Schnitzel example", () => {
    const humor = buildHumorGuidanceBlock({
      tone: "playful_luxury",
      language: "sr",
      productName: "Schnitzel",
      forbiddenPhrases: [],
    });
    expect(humor).toContain("Schnitzel");
    expect(humor).toContain("statistički");
    expect(humor).toContain("HUMOR ENGINE");
    expect(isHumorAllowed("playful_luxury", BASE_MENTAL)).toBe(true);
  });

  it("frustrated guest → empathy block, humor disabled", () => {
    const frustrated: GuestMentalModel = {
      ...BASE_MENTAL,
      affect: {
        frustration: { level: "high", signals: ["repeat_message"] },
        sentiment: { score: -0.5, lastSignals: ["negative"] },
      },
    };

    const emotional = buildEmotionalIntelligenceBlock({
      mentalModel: frustrated,
      persona: CONCIERGE_PLATFORM_DEFAULTS.persona,
    });
    expect(emotional).toContain("frustrated");
    expect(emotional).toContain("Apologize");
    expect(isHumorAllowed("playful_luxury", frustrated)).toBe(false);
  });

  it("return guest memory references past favorites", () => {
    const block = buildPersonalityBlock({
      persona: CONCIERGE_PLATFORM_DEFAULTS.persona,
      orgName: "Test",
      language: "sr",
      guestMemory: {
        allergies: [],
        favoriteItems: ["Riesling"],
        language: "sr",
        favoriteProductIds: [],
        allergySheetIds: [],
        allergyLabels: [],
        preferredLanguage: "sr",
        visitCount: 3,
        lastVisitItemNames: ["Riesling"],
        lastVisit: "2026-01-01",
        lastVisitAt: "2026-01-01",
        avgSpend: 45,
        mood: null,
      },
      featuredProductName: "novi Riesling",
    });
    expect(block).toContain("Riesling");
    expect(block).toContain("Prošli put");
  });

  it("time adaptation varies by day period", () => {
    const morning = resolveDayPeriod(new Date("2026-06-07T08:00:00Z"), "Europe/Berlin");
    const evening = resolveDayPeriod(new Date("2026-06-07T20:00:00Z"), "Europe/Berlin");
    expect(morning).toBe("morning");
    expect(evening).toBe("evening");
  });

  it("buildSystemPrompt injects personality block when persona set", () => {
    const prompt = buildSystemPrompt({
      orgName: "Skyline",
      menuText: "",
      language: "de",
      omitFullMenu: true,
      persona: {
        ...CONCIERGE_PLATFORM_DEFAULTS.persona,
        tone: "formal",
        name: "Denis",
      },
    });
    expect(prompt).toContain("IDENTITY:");
    expect(prompt).toContain("Denis");
    expect(prompt).toContain("BASE PERSONALITY");
    expect(prompt).toContain("VENUE TONE (formal)");
  });
});
