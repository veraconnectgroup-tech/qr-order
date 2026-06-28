import type { GuestRecoveryResult } from "@/lib/guest/denis-guest-recovery";
import { mapTurnQuickRepliesToChips } from "./map-turn-to-scene-overrides";
import type { SceneLayer } from "./types";

/** SC-7 recovery — map Denis guest recovery chips into scene chip layer. */
export function mapRecoveryToSceneLayer(
  recovery: Pick<GuestRecoveryResult, "quickReplies">
): SceneLayer | null {
  if (!recovery.quickReplies?.length) return null;
  const options = mapTurnQuickRepliesToChips(recovery.quickReplies);
  if (!options.length) return null;
  return { kind: "chips", options };
}

export function mergeRecoverySceneLayers(
  layers: SceneLayer[],
  recovery: Pick<GuestRecoveryResult, "quickReplies"> | null | undefined
): SceneLayer[] {
  const recoveryLayer = recovery ? mapRecoveryToSceneLayer(recovery) : null;
  if (!recoveryLayer) return layers;

  const withoutChips = layers.filter((layer) => layer.kind !== "chips");
  return [...withoutChips, recoveryLayer];
}
