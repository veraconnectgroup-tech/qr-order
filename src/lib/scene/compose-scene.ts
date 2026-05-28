import type { ComposeSceneInput, Scene, SceneLayer, SessionPhase } from "./types";

const LAYER_PRIORITY: Record<SceneLayer["kind"], number> = {
  blocking: 0,
  sheet: 1,
  banner: 2,
  inline: 3,
  chips: 4,
  ambient: 5,
};

export function deriveSessionPhase(input: {
  sessionClosed: boolean;
  hasOpenKitchenOrders: boolean;
  hasCartActivity: boolean;
  billSettled: boolean;
  allOrdersDelivered: boolean;
}): SessionPhase {
  if (input.sessionClosed) return "closed";
  if (input.billSettled || (input.allOrdersDelivered && !input.hasOpenKitchenOrders)) {
    return "settling";
  }
  if (input.hasOpenKitchenOrders) return "waiting";
  if (input.hasCartActivity) return "ordering";
  return "browsing";
}

/** Deterministic precedence — single place for guest UI structure (SC-1). */
export function composeScene(
  input: ComposeSceneInput,
  version = 1
): Scene {
  const layers: SceneLayer[] = [];

  if (input.blocking) {
    layers.push({
      kind: "blocking",
      reason: input.blocking.reason,
      message: input.blocking.message,
    });
  }

  const showSheet = input.sheetOpen || input.thinking;

  if (showSheet) {
    layers.push({
      kind: "sheet",
      open: input.sheetOpen,
      title: input.sheetTitle,
      thinking: input.thinking,
    });
  }

  for (const banner of input.banners) {
    layers.push({
      kind: "banner",
      id: banner.id,
      message: banner.message,
      action: banner.action,
      productId: banner.productId,
      productName: banner.productName,
    });
  }

  for (const rec of input.inlineRecommendations) {
    layers.push({
      kind: "inline",
      productId: rec.productId,
      name: rec.name,
      reason: rec.reason,
      priceCents: rec.priceCents,
    });
  }

  if (input.chips.length > 0) {
    layers.push({ kind: "chips", options: input.chips });
  }

  if (input.denisActive) {
    layers.push({ kind: "ambient" });
  }

  layers.sort(
    (a, b) => LAYER_PRIORITY[a.kind] - LAYER_PRIORITY[b.kind]
  );

  return {
    version,
    sessionId: input.sessionId,
    phase: input.phase,
    chrome: {
      tableName: input.tableName,
      venueName: input.venueName,
      markState: input.markState,
      denisActive: input.denisActive,
    },
    layers,
  };
}
