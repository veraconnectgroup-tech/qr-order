import {
  toSceneAccessibility,
  type GuestAccessibilityPrefs,
} from "@/lib/denis/cognition/mental-model/accessibility-types";
import { filterEssentialSceneLayers } from "@/lib/denis/cognition/mental-model/derive-accessibility";
import type { ComposeSceneInput } from "@/lib/scene/types";

/** Adapt guest scene composition for accessibility prefs (U3). */
export function adaptSceneForAccessibility(
  scene: ComposeSceneInput,
  accessibility: GuestAccessibilityPrefs
): ComposeSceneInput {
  const resolved = toSceneAccessibility(accessibility);
  const simplified = resolved.preferredMode === "simplified";

  if (!simplified && resolved.fontScale <= 1 && !resolved.highContrast) {
    return { ...scene, accessibility: resolved };
  }

  const largeText = resolved.fontScale >= 1.25;

  return {
    ...scene,
    accessibility: resolved,
    inlineRecommendations: simplified ? [] : scene.inlineRecommendations,
    banners: simplified
      ? scene.banners.slice(0, 1)
      : largeText
        ? scene.banners.slice(0, 2)
        : scene.banners,
    chips: scene.chips
      .slice(0, simplified ? 4 : scene.chips.length)
      .map((chip) => ({
        ...chip,
        label: simplified ? chip.label.slice(0, 28) : chip.label,
      })),
  };
}

export { filterEssentialSceneLayers as filterSceneLayersForAccessibility };
