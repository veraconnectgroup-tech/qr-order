import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  applyCapabilityClamps,
  clampManifestCapabilities,
  mergeManifestConfig,
} from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  normalizeVenueManifestInput,
  parseVenueManifest,
  VenueManifestSchema,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";

/** ADR-023 §6 sample (snake_case as stored in YAML/JSON). */
const ADR_023_SECTION_6_SAMPLE = {
  manifest_version: 1,
  identity: {
    persona: "playful_luxury",
    languages: ["de", "en", "sr"],
    default_language: "de",
  },
  capabilities: {
    relational: 3,
    transactional: 3,
    catalog_rag: 2,
    guest_memory: 2,
    anticipation: 2,
  },
  policy: {
    require_explicit_confirm: true,
    rush_skip_upsell: true,
    max_upsells_per_session: 1,
  },
  models: {
    transactional: "gpt-4o",
    relational: "gpt-4o",
    narrate: "gpt-4o-mini",
  },
  quality_contract: {
    refusal_rate_max: 0,
    eval_pass_min: 1.0,
    shadow_parity_min: 0.99,
    llm_invocation_max: 0.35,
  },
} as const;

describe("VenueManifest MR-4", () => {
  it("parses ADR-023 §6 sample (snake_case)", () => {
    const normalized = normalizeVenueManifestInput(ADR_023_SECTION_6_SAMPLE);
    expect(() => VenueManifestSchema.parse(normalized)).not.toThrow();

    const manifest = parseVenueManifest(ADR_023_SECTION_6_SAMPLE);
    expect(manifest).not.toBeNull();
    expect(manifest?.manifestVersion).toBe(1);
    expect(manifest?.identity?.persona).toBe("playful_luxury");
    expect(manifest?.identity?.defaultLanguage).toBe("de");
    expect(manifest?.capabilities.catalogRag).toBe(2);
    expect(manifest?.qualityContract?.llmInvocationMax).toBe(0.35);
  });

  it("returns null for invalid manifest without throwing", () => {
    expect(parseVenueManifest({ manifest_version: 99 })).toBeNull();
    expect(parseVenueManifest({ capabilities: { relational: 9 } })).toBeNull();
    expect(parseVenueManifest("not-json")).toBeNull();
  });

  it("mergeManifestConfig applies manifest policy and identity to ConciergeConfig", () => {
    const effective = mergeManifestConfig(
      CONCIERGE_PLATFORM_DEFAULTS,
      ADR_023_SECTION_6_SAMPLE
    );

    expect(effective.manifest).not.toBeNull();
    expect(effective.config.persona.tone).toBe("playful_luxury");
    expect(effective.config.language.venueDefault).toBe("de");
    expect(effective.config.ordering.requireExplicitConfirm).toBe(true);
    expect(effective.config.ops.rushSkipUpsell).toBe(true);
    expect(effective.config.upsell.maxUpsellsPerSession).toBe(1);
    expect(effective.config.llm.model).toBe("gpt-4o");
    expect(effective.config.llm.fallbackModel).toBe("gpt-4o-mini");
    expect(effective.models.transactional).toBe("gpt-4o");
    expect(effective.models.relational).toBe("gpt-4o");
    expect(effective.models.narrate).toBe("gpt-4o-mini");
    expect(effective.qualityContract?.refusalRateMax).toBe(0);
  });

  it("invalid manifest falls back to base config with open capabilities", () => {
    const base = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      upsell: { ...CONCIERGE_PLATFORM_DEFAULTS.upsell, maxUpsellsPerSession: 5 },
    };

    const effective = mergeManifestConfig(base, { manifest_version: 2 });

    expect(effective.manifest).toBeNull();
    expect(effective.config.upsell.maxUpsellsPerSession).toBe(5);
    expect(effective.config.persona.tone).toBe(base.persona.tone);
    expect(effective.capabilities.relational).toBe(4);
    expect(effective.qualityContract).toBeNull();
  });

  it("org ceiling clamps location capabilities", () => {
    const location = {
      ...ADR_023_SECTION_6_SAMPLE,
      capabilities: {
        relational: 4,
        transactional: 4,
        catalog_rag: 3,
        guest_memory: 3,
        anticipation: 3,
      },
    };

    const orgCeiling = {
      manifest_version: 1,
      capabilities: {
        relational: 2,
        transactional: 3,
        catalog_rag: 1,
        guest_memory: 1,
        anticipation: 2,
      },
    };

    const effective = mergeManifestConfig(CONCIERGE_PLATFORM_DEFAULTS, location, {
      orgCeilingRaw: orgCeiling,
    });

    expect(effective.capabilities).toEqual({
      relational: 2,
      transactional: 3,
      catalogRag: 1,
      guestMemory: 1,
      anticipation: 2,
    });
  });

  it("capability clamps disable guest memory and low anticipation features", () => {
    const clamped = applyCapabilityClamps(CONCIERGE_PLATFORM_DEFAULTS, {
      relational: 4,
      transactional: 4,
      catalogRag: 4,
      guestMemory: 1,
      anticipation: 0,
    });

    expect(clamped.memory.returnGuestEnabled).toBe(false);
    expect(clamped.proactive.enabled).toBe(false);

    const partialAnticipation = applyCapabilityClamps(CONCIERGE_PLATFORM_DEFAULTS, {
      relational: 4,
      transactional: 4,
      catalogRag: 4,
      guestMemory: 4,
      anticipation: 1,
    });

    expect(partialAnticipation.proactive.enabled).toBe(true);
    expect(partialAnticipation.proactive.dessert).toBe(false);
    expect(partialAnticipation.proactive.pairing).toBe(false);
  });

  it("merge applies org-clamped capabilities to config", () => {
    const effective = mergeManifestConfig(
      {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        memory: {
          ...CONCIERGE_PLATFORM_DEFAULTS.memory,
          returnGuestEnabled: true,
        },
      },
      ADR_023_SECTION_6_SAMPLE,
      {
        orgCeilingRaw: {
          manifest_version: 1,
          capabilities: {
            relational: 3,
            transactional: 3,
            catalog_rag: 2,
            guest_memory: 1,
            anticipation: 1,
          },
        },
      }
    );

    expect(effective.capabilities.guestMemory).toBe(1);
    expect(effective.capabilities.anticipation).toBe(1);
    expect(effective.config.memory.returnGuestEnabled).toBe(false);
    expect(effective.config.proactive.dessert).toBe(false);
  });

  it("clampManifestCapabilities is pure min per axis", () => {
    expect(
      clampManifestCapabilities(
        {
          relational: 4,
          transactional: 3,
          catalogRag: 2,
          guestMemory: 2,
          anticipation: 2,
        },
        {
          relational: 2,
          transactional: 4,
          catalogRag: 1,
          guestMemory: 3,
          anticipation: 1,
        }
      )
    ).toEqual({
      relational: 2,
      transactional: 3,
      catalogRag: 1,
      guestMemory: 2,
      anticipation: 1,
    });
  });
});
