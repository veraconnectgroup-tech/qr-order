import type { AiRecommendation } from "@/lib/ai/types";
import type { ComposeSceneInput } from "./types";

export type SceneRefreshOverrides = {
  sessionId: string;
  markState?: ComposeSceneInput["markState"];
  thinking?: boolean;
  sheetOpen?: boolean;
  chips?: ComposeSceneInput["chips"];
  inlineRecommendations?: ComposeSceneInput["inlineRecommendations"];
};

type TurnRecommendation = AiRecommendation & {
  productName?: string;
  name?: string;
  price?: number;
};

function slugChipId(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return slug ? `chip-${slug}` : `chip-${index}`;
}

export function mapTurnQuickRepliesToChips(
  quickReplies: string[]
): ComposeSceneInput["chips"] {
  return quickReplies
    .map((label, index) => ({
      id: slugChipId(label, index),
      label: label.trim(),
    }))
    .filter((chip) => chip.label.length > 0)
    .slice(0, 6);
}

export function mapTurnRecommendationsToInline(
  recommendations: TurnRecommendation[] | undefined,
  productNames: Record<string, string> = {}
): ComposeSceneInput["inlineRecommendations"] {
  if (!recommendations?.length) return [];

  return recommendations
    .filter((rec) => Boolean(rec.productId))
    .slice(0, 4)
    .map((rec) => ({
      productId: rec.productId,
      name:
        rec.productName ??
        rec.name ??
        productNames[rec.productId] ??
        rec.productId,
      reason: rec.reason,
      priceCents:
        typeof rec.price === "number" && Number.isFinite(rec.price)
          ? Math.round(rec.price * 100)
          : undefined,
    }));
}

/** SC-7 — map Denis turn output into scene refresh overrides. */
export function mapTurnToSceneOverrides(input: {
  tableSessionId: string;
  quickReplies?: string[];
  recommendations?: TurnRecommendation[];
  productNames?: Record<string, string>;
  markState?: ComposeSceneInput["markState"];
  thinking?: boolean;
  sheetOpen?: boolean;
}): SceneRefreshOverrides {
  return {
    sessionId: input.tableSessionId,
    markState: input.markState ?? "idle",
    thinking: input.thinking ?? false,
    sheetOpen: input.sheetOpen ?? false,
    chips: mapTurnQuickRepliesToChips(input.quickReplies ?? []),
    inlineRecommendations: mapTurnRecommendationsToInline(
      input.recommendations,
      input.productNames
    ),
  };
}
