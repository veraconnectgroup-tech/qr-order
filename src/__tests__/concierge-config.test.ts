import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  ConciergeConfigSchema,
  parsePartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import {
  mergeConciergeConfig,
  resolveConciergeConfig,
} from "@/lib/denis/config/merge-concierge-config";

describe("ConciergeConfig M1", () => {
  it("platform defaults validate against schema", () => {
    expect(() =>
      ConciergeConfigSchema.parse(CONCIERGE_PLATFORM_DEFAULTS)
    ).not.toThrow();
  });

  it("merges org then location with location winning on scalars", () => {
    const merged = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, {
      persona: { name: "OrgDenis" },
    }, {
      persona: { name: "LocalDenis", maxWordsPerReply: 30 },
    });

    expect(merged.persona.name).toBe("LocalDenis");
    expect(merged.persona.maxWordsPerReply).toBe(30);
    expect(merged.persona.tone).toBe("warm_short");
  });

  it("replaces arrays wholesale on merge", () => {
    const merged = mergeConciergeConfig(
      CONCIERGE_PLATFORM_DEFAULTS,
      null,
      {
        persona: {
          forbiddenPhrases: ["As an AI"],
        },
        handoff: {
          phrases: ["konobar", "waiter"],
        },
      }
    );

    expect(merged.persona.forbiddenPhrases).toEqual(["As an AI"]);
    expect(merged.handoff.phrases).toEqual(["konobar", "waiter"]);
  });

  it("applies menu locale when location did not override language", () => {
    const config = resolveConciergeConfig({
      menuLocale: "sr",
    });
    expect(config.language.venueDefault).toBe("sr");
  });

  it("keeps explicit location language override over menu locale", () => {
    const config = resolveConciergeConfig({
      menuLocale: "sr",
      locationConfig: {
        language: { venueDefault: "hr" },
      },
    });
    expect(config.language.venueDefault).toBe("hr");
  });

  it("rejects invalid partial config fragments", () => {
    expect(parsePartialConciergeConfig({ version: 99 })).toBeNull();
    expect(parsePartialConciergeConfig({ persona: { maxWordsPerReply: 9999 } })).toBeNull();
  });

  it("accepts valid partial overrides", () => {
    const partial = parsePartialConciergeConfig({
      upsell: { maxUpsellsPerSession: 1 },
      policy: { allergiesStrict: false },
    });
    expect(partial?.upsell?.maxUpsellsPerSession).toBe(1);
    expect(partial?.policy?.allergiesStrict).toBe(false);
  });
});
