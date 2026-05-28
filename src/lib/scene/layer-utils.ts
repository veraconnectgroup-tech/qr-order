import type { Scene, SceneLayer } from "@/lib/scene/types";

export type SceneBannerLayer = Extract<SceneLayer, { kind: "banner" }>;
export type SceneSheetLayer = Extract<SceneLayer, { kind: "sheet" }>;
export type SceneBlockingLayer = Extract<SceneLayer, { kind: "blocking" }>;

export function sceneBannerLayers(scene: Scene): SceneBannerLayer[] {
  return scene.layers.filter((layer): layer is SceneBannerLayer => layer.kind === "banner");
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
