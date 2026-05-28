import type { ComposeSceneInput, Scene, SceneLayer } from "./types";

function sceneChipsFromLayers(layers: SceneLayer[]): ComposeSceneInput["chips"] {
  const chipsLayer = layers.find(
    (layer): layer is Extract<SceneLayer, { kind: "chips" }> =>
      layer.kind === "chips"
  );
  return chipsLayer?.options ?? [];
}

function sceneInlineFromLayers(
  layers: SceneLayer[]
): ComposeSceneInput["inlineRecommendations"] {
  return layers
    .filter(
      (layer): layer is Extract<SceneLayer, { kind: "inline" }> =>
        layer.kind === "inline"
    )
    .map((layer) => ({
      productId: layer.productId,
      name: layer.name,
      reason: layer.reason,
      priceCents: layer.priceCents,
    }));
}

export function extractPersistedSceneLayers(
  scene: Scene | null | undefined
): Pick<ComposeSceneInput, "chips" | "inlineRecommendations"> {
  if (!scene) {
    return { chips: [], inlineRecommendations: [] };
  }

  return {
    chips: sceneChipsFromLayers(scene.layers),
    inlineRecommendations: sceneInlineFromLayers(scene.layers),
  };
}
