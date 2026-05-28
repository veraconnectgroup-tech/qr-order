import type { Scene, StaffDetailView, StaffTileView } from "./types";

function firstAlertMessage(scene: Scene): string | null {
  for (const layer of scene.layers) {
    if (layer.kind === "blocking") return layer.message;
    if (layer.kind === "banner") return layer.message;
  }
  return null;
}

export function sceneStaffTile(scene: Scene): StaffTileView {
  return {
    sessionId: scene.sessionId,
    tableName: scene.chrome.tableName,
    phase: scene.phase,
    denisActive: scene.chrome.denisActive,
    markState: scene.chrome.markState,
    alertMessage: firstAlertMessage(scene),
  };
}

export function sceneStaffDetail(scene: Scene): StaffDetailView {
  return {
    ...sceneStaffTile(scene),
    venueName: scene.chrome.venueName,
    layers: scene.layers,
    version: scene.version,
  };
}
