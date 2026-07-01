import { describe, expect, it } from "vitest";
import {
  deriveGuestAccessibility,
  buildAccessibilityEvidenceBlock,
  filterEssentialSceneLayers,
} from "@/lib/denis/cognition/mental-model/derive-accessibility";
import { adaptSceneForAccessibility } from "@/lib/denis/intelligence/accessibility-adapter";
import {
  guestAccessibilityClassNames,
  toSceneAccessibility,
  type SceneAccessibility,
} from "@/lib/denis/cognition/mental-model/accessibility-types";
import type { ComposeSceneInput } from "@/lib/scene/types";

function baseSceneInput(): ComposeSceneInput {
  return {
    sessionId: "sess-1",
    tableName: "Table 4",
    venueName: "Kafana",
    phase: "browsing",
    markState: "idle",
    denisActive: true,
    sheetOpen: false,
    sheetTitle: "Denis",
    thinking: false,
    blocking: null,
    banners: [
      { id: "b1", message: "Banner 1" },
      { id: "b2", message: "Banner 2" },
    ],
    inlineRecommendations: [
      { productId: "p1", name: "Burger", priceCents: 900 },
    ],
    chips: [{ id: "c1", label: "Pogledaj meni" }],
    situation: null,
  };
}

describe("accessibility intelligence (U3)", () => {
  it("povećaj tekst → fontScale 1.5 and high contrast", () => {
    const prefs = deriveGuestAccessibility({
      timeline: [],
      guestMessage: "Možeš li povećaj tekst molim te?",
    });

    expect(prefs.fontScale).toBe(1.5);
    expect(prefs.highContrast).toBe(true);
  });

  it("screen reader signal → simplified mode", () => {
    const prefs = deriveGuestAccessibility({
      timeline: [],
      clientSignals: { screenReader: true },
    });

    expect(prefs.preferredMode).toBe("simplified");
    expect(prefs.highContrast).toBe(true);
    expect(prefs.fontScale).toBeGreaterThanOrEqual(1.25);
  });

  it("voice input surface → voice mode with auto TTS scene flags", () => {
    const prefs = deriveGuestAccessibility({
      timeline: [],
      inputSurface: "voice",
    });

    const scene = toSceneAccessibility(prefs);
    expect(scene.preferredMode).toBe("voice");
    expect(scene.autoTts).toBe(true);
    expect(scene.maxReplySentences).toBe(2);
  });

  it("adaptSceneForAccessibility strips inline recs in simplified mode", () => {
    const adapted = adaptSceneForAccessibility(baseSceneInput(), {
      preferredMode: "simplified",
      fontScale: 1.25,
      highContrast: false,
      reducedMotion: false,
    });

    expect(adapted.inlineRecommendations).toEqual([]);
    expect(adapted.banners).toHaveLength(1);
    expect(
      (adapted.accessibility as SceneAccessibility).chipMinHeightPx
    ).toBe(56);
  });

  it("buildAccessibilityEvidenceBlock includes reply limit directive", () => {
    const block = buildAccessibilityEvidenceBlock({
      preferredMode: "simplified",
      fontScale: 1.5,
      highContrast: true,
      reducedMotion: false,
    });

    expect(block).toContain("ACCESSIBILITY");
    expect(block).toContain("max 2 sentences");
    expect(block).toContain("Large text");
  });

  it("fontScale 1.5 → guest-a11y-large-text CSS hook", () => {
    const classes = guestAccessibilityClassNames({
      preferredMode: "default",
      fontScale: 1.5,
      highContrast: false,
      reducedMotion: false,
    });
    expect(classes).toContain("guest-a11y-large-text");
  });

  it("filterEssentialSceneLayers keeps only essential kinds in simplified mode", () => {
    const layers = [
      { kind: "banner", id: "b1" },
      { kind: "inline", id: "i1" },
      { kind: "chips", id: "c1" },
      { kind: "presence", id: "p1" },
    ];
    const filtered = filterEssentialSceneLayers(layers, {
      preferredMode: "simplified",
      fontScale: 1.25,
      highContrast: false,
      reducedMotion: false,
    });
    expect(filtered.map((l) => l.kind)).toEqual(["banner", "chips"]);
  });

  it("adaptSceneForAccessibility with fontScale 1.5 caps banners", () => {
    const adapted = adaptSceneForAccessibility(
      {
        ...baseSceneInput(),
        banners: [
          { id: "b1", message: "One" },
          { id: "b2", message: "Two" },
          { id: "b3", message: "Three" },
        ],
      },
      {
        preferredMode: "default",
        fontScale: 1.5,
        highContrast: true,
        reducedMotion: false,
      }
    );
    expect(adapted.banners).toHaveLength(2);
    expect(adapted.accessibility?.fontScale).toBe(1.5);
  });
});
