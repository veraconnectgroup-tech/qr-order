import type { TableSessionView } from "@/lib/denis/loop/view-types";
import type { Scene, SceneLayer } from "@/lib/scene/types";

export type SceneBannerLayer = Extract<SceneLayer, { kind: "banner" }>;
export type SceneSheetLayer = Extract<SceneLayer, { kind: "sheet" }>;
export type SceneBlockingLayer = Extract<SceneLayer, { kind: "blocking" }>;

export function sceneBannerLayers(scene: Scene): SceneBannerLayer[] {
  return scene.layers.filter((layer): layer is SceneBannerLayer => layer.kind === "banner");
}

/** F4 — banner layers from view read model (no parallel scene fetch). */
export function viewBannerLayers(view: TableSessionView | null): SceneBannerLayer[] {
  if (!view) return [];
  return view.layers.filter((layer): layer is SceneBannerLayer => layer.kind === "banner");
}

export function viewCapacityAmbientLayer(
  view: TableSessionView | null
): { capacityLevel: "green" | "yellow" | "red"; capacityMessage: string | null } | null {
  const capacityBanner = viewBannerLayers(view).find((layer) =>
    layer.id.includes("capacity")
  );
  if (!capacityBanner?.message) return null;

  const level = capacityBanner.message.includes("🔴")
    ? "red"
    : capacityBanner.message.includes("🟡")
      ? "yellow"
      : "green";

  return {
    capacityLevel: level,
    capacityMessage: capacityBanner.message,
  };
}

export function sceneSheetLayer(scene: Scene): SceneSheetLayer | null {
  return scene.layers.find((layer): layer is SceneSheetLayer => layer.kind === "sheet") ?? null;
}

export function sceneBlockingLayer(scene: Scene): SceneBlockingLayer | null {
  return (
    scene.layers.find((layer): layer is SceneBlockingLayer => layer.kind === "blocking") ??
    null
  );
}

export function sceneHasDenisAmbient(scene: Scene): boolean {
  return scene.layers.some((layer) => layer.kind === "ambient");
}

export type SceneChipsLayer = Extract<SceneLayer, { kind: "chips" }>;
export type SceneInlineLayer = Extract<SceneLayer, { kind: "inline" }>;

export function sceneChipsLayer(scene: Scene): SceneChipsLayer | null {
  return (
    scene.layers.find((layer): layer is SceneChipsLayer => layer.kind === "chips") ??
    null
  );
}

export function sceneInlineLayers(scene: Scene): SceneInlineLayer[] {
  return scene.layers.filter(
    (layer): layer is SceneInlineLayer => layer.kind === "inline"
  );
}
