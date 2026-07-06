import { computeStationQueues } from "@/lib/denis/venue/floor/compute-station-queues";
import { resolveVenueChaosRatio } from "@/lib/denis/venue/floor/resolve-venue-chaos-ratio";
import type { KitchenBacklogOrder } from "@/lib/denis/venue/floor/compute-kds-backlog";

export type StationVoiceSnapshot = {
  venueChaosRatio: number;
  openQuestionCount: number;
};

/**
 * Server-truth Part III (ADR-048) Operational Knowledge projection for one
 * station's voice tone — how slammed is THIS station right now, from real
 * order backlog the client never has, not just how many questions are on
 * screen. Pure — the DB read lives in load-station-voice-snapshot.ts.
 */
export function resolveStationVoiceSnapshot(input: {
  orders: KitchenBacklogOrder[];
  openQuestionCount: number;
  station: "kitchen" | "bar";
  nowMs?: number;
}): StationVoiceSnapshot {
  const queues = computeStationQueues(input.orders, input.nowMs);
  const stationQueue = queues.find((queue) => queue.station === input.station);

  const venueChaosRatio = resolveVenueChaosRatio({
    openQuestionCount: input.openQuestionCount,
    averageBacklogMinutes: stationQueue?.avgWaitMinutes ?? null,
  });

  return { venueChaosRatio, openQuestionCount: input.openQuestionCount };
}
