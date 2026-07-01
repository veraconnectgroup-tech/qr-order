import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";

export type AbandonmentPreventionAnalytics = {
  preventionEmitted: number;
  preventionConverted: number;
  preventionRate: number;
  postInterventionConversionRate: number;
  byKind: Record<string, number>;
  ignored: number;
  declined: number;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Aggregate prevention vs recovery analytics from Denis timelines. */
export function aggregateAbandonmentPreventionFromTimelines(
  timelines: DenisTimelineRow[][]
): AbandonmentPreventionAnalytics {
  let preventionEmitted = 0;
  const byKind: Record<string, number> = {};
  let ignored = 0;
  let declined = 0;

  for (const timeline of timelines) {
    const lifecycle = foldNudgeOutcomes(timeline, Date.now());

    for (const row of timeline) {
      if (row.event_type !== "proactive.emitted") continue;
      const payload = asRecord(row.payload);
      const kind = typeof payload.kind === "string" ? payload.kind : "";
      if (kind !== "cart_abandonment_prevention") continue;

      preventionEmitted += 1;
      const resolution =
        typeof payload.offerResolution === "string"
          ? payload.offerResolution
          : "unknown";
      byKind[resolution] = (byKind[resolution] ?? 0) + 1;
    }

    for (const outcome of lifecycle.outcomes) {
      if (outcome.nudgeKind !== "cart_abandonment_prevention") continue;
      if (outcome.outcome === "ignored") ignored += 1;
      if (outcome.outcome === "declined") declined += 1;
    }
  }

  const conversions = timelines.flatMap((timeline) =>
    foldOfferConversions(timeline)
  );
  const preventionConverted = conversions.filter((row) =>
    timelines.some((timeline) =>
      timeline.some((event) => {
        if (event.event_type !== "proactive.emitted") return false;
        const payload = asRecord(event.payload);
        return (
          payload.kind === "cart_abandonment_prevention" &&
          payload.productId === row.productId
        );
      })
    )
  ).length;

  const preventionRate =
    preventionEmitted > 0 ? preventionConverted / preventionEmitted : 0;

  return {
    preventionEmitted,
    preventionConverted,
    preventionRate,
    postInterventionConversionRate: preventionRate,
    byKind,
    ignored,
    declined,
  };
}
