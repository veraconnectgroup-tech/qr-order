import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type ProductNudgePerformance = {
  productId: string;
  productName: string | null;
  impressions: number;
  accepts: number;
  acceptRate: number;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Per-product nudge impressions/accepts across session timelines (ADR-039 L4). */
export function aggregateProductNudgeStatsFromTimelines(
  timelines: DenisTimelineRow[][]
): ProductNudgePerformance[] {
  const stats = new Map<
    string,
    { productName: string | null; impressions: number; accepts: number }
  >();

  for (const timeline of timelines) {
    for (const row of timeline) {
      if (row.event_type !== "proactive.emitted") continue;
      const payload = asRecord(row.payload);
      const productId =
        typeof payload.productId === "string" && payload.productId.trim()
          ? payload.productId.trim()
          : null;
      if (!productId) continue;

      const entry = stats.get(productId) ?? {
        productName:
          typeof payload.productName === "string" ? payload.productName : null,
        impressions: 0,
        accepts: 0,
      };
      entry.impressions += 1;
      if (payload.productName && !entry.productName) {
        entry.productName = String(payload.productName);
      }
      stats.set(productId, entry);
    }

    const { outcomes } = foldNudgeOutcomes(timeline);
    for (const outcome of outcomes) {
      if (outcome.outcome !== "accepted" || !outcome.productId) continue;
      const entry = stats.get(outcome.productId) ?? {
        productName: outcome.productName,
        impressions: 0,
        accepts: 0,
      };
      entry.accepts += 1;
      if (outcome.productName && !entry.productName) {
        entry.productName = outcome.productName;
      }
      stats.set(outcome.productId, entry);
    }
  }

  return [...stats.entries()]
    .map(([productId, row]) => ({
      productId,
      productName: row.productName,
      impressions: row.impressions,
      accepts: row.accepts,
      acceptRate: row.impressions > 0 ? row.accepts / row.impressions : 0,
    }))
    .sort((a, b) => {
      if (b.acceptRate !== a.acceptRate) return b.acceptRate - a.acceptRate;
      return b.impressions - a.impressions;
    });
}
