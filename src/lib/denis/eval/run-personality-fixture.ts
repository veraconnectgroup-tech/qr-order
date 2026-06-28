import type { ConciergePersona } from "@/lib/denis/config/concierge-config.schema";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { emptyGuestPredictiveModel } from "@/lib/denis/cognition/mental-model/empty-predictive-model";
import {
  buildPersonalityBlock,
  buildEmotionalIntelligenceBlock,
} from "@/lib/denis/cognition/personality/personality-engine";
import {
  buildHumorGuidanceBlock,
  isHumorAllowed,
} from "@/lib/denis/cognition/personality/humor-engine";
import { buildCulturalSensitivityBlock, resolveCulturalProfile } from "@/lib/denis/cognition/personality/cultural-sensitivity";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

export type PersonalityScenario = {
  id: string;
  persona: ConciergePersona;
  language: string;
  mentalModel?: GuestMentalModel | null;
  expect: {
    contains?: string[];
    excludes?: string[];
    humorAllowed?: boolean;
  };
};

const BASE_MENTAL: GuestMentalModel = {
  version: 1,
  computedAt: Date.now(),
  confidence: 0.8,
  hash: "eval",
  decline: {
    dismissedCount: 0,
    explicitCount: 0,
    hardClosed: false,
    lastDeclineAt: null,
  },
  intent: "exploring",
  intentTransitions: [],
  pace: "normal",
  receptiveness: "open",
  engagement: {
    guestTurns: 2,
    avgMsgLen: 20,
    guestInitiated: true,
    nudgeResponseRate: 0.5,
  },
  nudgeBudget: { remaining: 2, max: 3, cooldownUntil: null },
  mealStage: "pre_order",
  priceAffinity: "mid",
  predictedNeed: "none",
  affect: {
    frustration: { level: "none", signals: [] },
    sentiment: { score: 0.5, lastSignals: [] },
  },
  groupDynamics: {
    mode: "solo",
    leaderDevice: null,
    followerDevices: [],
    addressLeader: true,
  },
  fusion: {
    readiness: { score: 0.5, band: "medium", offerSubmit: false },
    guidance: {
      style: "default",
      nextLogicalStep: null,
      abnormalTransition: null,
      hint: null,
    },
    anomalies: [],
  },
  predictions: emptyGuestPredictiveModel(),
};

export const PERSONALITY_SCENARIOS: PersonalityScenario[] = [
  {
    id: "formal_de_siezen",
    persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "formal" },
    language: "de",
    expect: {
      contains: ["Siezen", "VENUE TONE (formal)"],
    },
  },
  {
    id: "formal_sr_respectful",
    persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "formal" },
    language: "sr",
    expect: {
      contains: ["VENUE TONE (formal)", "Vi-formal"],
    },
  },
  {
    id: "playful_humor_schnitzel",
    persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "playful_luxury" },
    language: "sr",
    expect: {
      contains: ["HUMOR ENGINE", "Schnitzel"],
      humorAllowed: true,
    },
  },
  {
    id: "angry_guest_empathy",
    persona: { ...CONCIERGE_PLATFORM_DEFAULTS.persona, tone: "playful_luxury" },
    language: "en",
    mentalModel: {
      ...BASE_MENTAL,
      affect: {
        frustration: { level: "high", signals: ["angry"] },
        sentiment: { score: -0.8, lastSignals: [] },
      },
    },
    expect: {
      contains: ["frustrated", "Apologize"],
      excludes: ["HUMOR ENGINE"],
      humorAllowed: false,
    },
  },
];

export function runPersonalityScenario(
  scenario: PersonalityScenario
): { id: string; passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const block = buildPersonalityBlock({
    persona: scenario.persona,
    orgName: "Eval Venue",
    language: scenario.language,
    mentalModel: scenario.mentalModel ?? null,
    featuredProductName: "Schnitzel",
  });

  for (const needle of scenario.expect.contains ?? []) {
    if (!block.includes(needle)) {
      errors.push(`expected block to contain "${needle}"`);
    }
  }

  for (const needle of scenario.expect.excludes ?? []) {
    if (block.includes(needle)) {
      errors.push(`expected block to exclude "${needle}"`);
    }
  }

  if (scenario.expect.humorAllowed !== undefined) {
    const allowed = isHumorAllowed(
      scenario.persona.tone,
      scenario.mentalModel ?? null
    );
    if (allowed !== scenario.expect.humorAllowed) {
      errors.push(
        `expected humorAllowed=${scenario.expect.humorAllowed}, got ${allowed}`
      );
    }
  }

  const cultural = buildCulturalSensitivityBlock(
    resolveCulturalProfile(scenario.language)
  );
  if (scenario.id === "formal_sr_respectful" && !cultural.includes("Vi-formal")) {
    errors.push("expected SR cultural block with Vi-formal");
  }

  if (scenario.mentalModel) {
    const emotional = buildEmotionalIntelligenceBlock({
      mentalModel: scenario.mentalModel,
      persona: scenario.persona,
    });
    if (scenario.id === "angry_guest_empathy" && !emotional?.includes("frustrated")) {
      errors.push("expected emotional intelligence frustration block");
    }
  }

  if (scenario.id === "playful_humor_schnitzel") {
    const humor = buildHumorGuidanceBlock({
      tone: "playful_luxury",
      language: "sr",
      productName: "Schnitzel",
      forbiddenPhrases: [],
    });
    if (!humor?.includes("Schnitzel")) {
      errors.push("expected Schnitzel in humor example");
    }
  }

  return { id: scenario.id, passed: errors.length === 0, errors };
}

export function runPersonalitySuite(): {
  ok: boolean;
  scenarioCount: number;
  results: ReturnType<typeof runPersonalityScenario>[];
} {
  const results = PERSONALITY_SCENARIOS.map(runPersonalityScenario);
  return {
    ok: results.every((r) => r.passed),
    scenarioCount: results.length,
    results,
  };
}
