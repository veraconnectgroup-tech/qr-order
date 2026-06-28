import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildConciergeConfigPreview } from "@/lib/denis/config/concierge-config-preview";
import {
  exportConciergeConfig,
  importConciergeConfig,
} from "@/lib/denis/config/concierge-config-io";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  buildToneAbExperiment,
  compareToneUpsellRates,
} from "@/lib/denis/eval/tone-ab-comparison";

describe("concierge config preview", () => {
  it("updates preview when tone changes", () => {
    const warm = buildConciergeConfigPreview({
      persona: {
        ...CONCIERGE_PLATFORM_DEFAULTS.persona,
        tone: "warm_short",
      },
      language: CONCIERGE_PLATFORM_DEFAULTS.language,
    });
    const formal = buildConciergeConfigPreview({
      persona: {
        ...CONCIERGE_PLATFORM_DEFAULTS.persona,
        tone: "formal",
      },
      language: CONCIERGE_PLATFORM_DEFAULTS.language,
    });

    expect(warm.sampleReply).not.toBe(formal.sampleReply);
    expect(warm.transcript[2]?.text).not.toBe(formal.transcript[2]?.text);
  });

  it("changes greeting style in preview transcript", () => {
    const drinkFood = buildConciergeConfigPreview({
      persona: {
        ...CONCIERGE_PLATFORM_DEFAULTS.persona,
        greetingStyle: "offer_drink_or_food",
      },
      language: { ...CONCIERGE_PLATFORM_DEFAULTS.language, venueDefault: "sr" },
    });
    const welcome = buildConciergeConfigPreview({
      persona: {
        ...CONCIERGE_PLATFORM_DEFAULTS.persona,
        greetingStyle: "welcome_only",
      },
      language: { ...CONCIERGE_PLATFORM_DEFAULTS.language, venueDefault: "sr" },
    });

    expect(drinkFood.greeting.toLowerCase()).toContain("piće");
    expect(welcome.greeting.toLowerCase()).toContain("denis");
  });
});

describe("concierge config per-location merge", () => {
  it("applies different persona per location override", () => {
    const hq = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      persona: { tone: "formal", name: "Denis HQ" },
    });
    const beach = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      persona: { tone: "playful_luxury", name: "Denis Beach" },
    });

    expect(hq.persona.tone).toBe("formal");
    expect(beach.persona.tone).toBe("playful_luxury");
    expect(hq.persona.name).toBe("Denis HQ");
    expect(beach.persona.name).toBe("Denis Beach");
  });
});

describe("concierge config import/export", () => {
  it("exports and re-imports valid JSON", () => {
    const patch = {
      persona: { tone: "efficient" as const, maxWordsPerReply: 25 },
      upsell: { maxUpsellsPerSession: 1 },
    };
    const json = exportConciergeConfig(patch);
    const imported = importConciergeConfig(json);

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.config.persona?.tone).toBe("efficient");
      expect(imported.config.persona?.maxWordsPerReply).toBe(25);
      expect(imported.config.upsell?.maxUpsellsPerSession).toBe(1);
    }
  });

  it("rejects invalid export payload", () => {
    const result = importConciergeConfig('{"persona":{"maxWordsPerReply":9999}}');
    expect(result.ok).toBe(false);
  });
});

describe("tone A/B comparison", () => {
  it("builds 50/50 tone experiment and evaluates upsell metric", () => {
    const experiment = buildToneAbExperiment({
      toneA: "formal",
      toneB: "playful_luxury",
      trafficSplit: 0.5,
    });
    expect(experiment.metric).toBe("upsell_accept_rate");
    expect(experiment.trafficSplit).toBe(0.5);

    const sessionsA = Array.from({ length: 100 }, (_, i) => ({
      sessionToken: `a-${i}`,
      converted: true,
      orderValueCents: 2000,
      upsellAccepted: i % 5 === 0,
      minutesToFirstOrder: 8,
    }));
    const sessionsB = Array.from({ length: 100 }, (_, i) => ({
      sessionToken: `b-${i}`,
      converted: true,
      orderValueCents: 2200,
      upsellAccepted: i % 3 === 0,
      minutesToFirstOrder: 7,
    }));

    const result = compareToneUpsellRates({
      experiment,
      sessionsA,
      sessionsB,
    });
    expect(result.variantBMetric).toBeGreaterThan(result.variantAMetric);
  });
});
