import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ConciergeTone } from "@/lib/denis/config/concierge-config.schema";
import {
  evaluateAbExperiment,
  type AbExperiment,
  type AbExperimentResult,
  type AbSessionMetrics,
} from "@/lib/denis/config/ab-experiment";

export function buildToneAbExperiment(input: {
  id?: string;
  toneA: ConciergeTone;
  toneB: ConciergeTone;
  trafficSplit?: number;
  minSessions?: number;
}): AbExperiment {
  const variantA: PartialConciergeConfig = {
    persona: { tone: input.toneA },
  };
  const variantB: PartialConciergeConfig = {
    persona: { tone: input.toneB },
  };

  return {
    id: input.id ?? `tone-${input.toneA}-vs-${input.toneB}`,
    metric: "upsell_accept_rate",
    variantA,
    variantB,
    trafficSplit: input.trafficSplit ?? 0.5,
    minSessions: input.minSessions ?? 100,
    autoApply: false,
    ownerApprovedApply: false,
    startedAt: new Date().toISOString(),
    status: "running",
  };
}

export function compareToneUpsellRates(input: {
  experiment: AbExperiment;
  sessionsA: AbSessionMetrics[];
  sessionsB: AbSessionMetrics[];
}): AbExperimentResult {
  return evaluateAbExperiment(input.experiment, input.sessionsA, input.sessionsB);
}

export function describeToneAbWinner(result: AbExperimentResult): string {
  if (result.winner === "inconclusive") {
    return result.recommendation;
  }
  return result.winner === "B"
    ? `Ton B ima bolji upsell rate (+${Math.round(result.lift * 100)}%).`
    : `Ton A ima bolji upsell rate.`;
}
