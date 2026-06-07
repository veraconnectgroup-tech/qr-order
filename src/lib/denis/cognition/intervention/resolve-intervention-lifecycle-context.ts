import { extractPendingInterventionFromTimeline } from "@/lib/denis/cognition/intervention/extract-pending-intervention-from-timeline";
import type { InterventionDecision } from "@/lib/denis/cognition/intervention/intervention-types";
import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const DEFAULT_DEFER_DEBOUNCE_SEC = 15;

export type InterventionLifecycleContext = {
  previousDecision: InterventionDecision | null;
  previousInterventionId: string | null;
  deferExpired: boolean;
};

/** Resolve supersede/expired inputs for the next IJS journal row (ADR-041 P5). */
export function resolveInterventionLifecycleContext(input: {
  timeline: DenisTimelineRow[];
  manifest: InterventionManifest;
  nowMs?: number;
}): InterventionLifecycleContext {
  const pending = extractPendingInterventionFromTimeline(input.timeline);
  if (!pending) {
    return {
      previousDecision: null,
      previousInterventionId: null,
      deferExpired: false,
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const rule = input.manifest.rules.find((row) => row.id === pending.ruleId);
  const debounceSec = rule?.defer?.debounceSec ?? DEFAULT_DEFER_DEBOUNCE_SEC;
  const deferExpired = nowMs - pending.deferredAtMs >= debounceSec * 1000;

  return {
    previousDecision: pending.decision,
    previousInterventionId: pending.interventionId,
    deferExpired,
  };
}
