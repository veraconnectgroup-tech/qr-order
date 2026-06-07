import { rhythmSlotKey } from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import { nextLocalSlot } from "@/lib/denis/config/venue-local-time";

export type RhythmOpsEvaluation = {
  nextSlotKey: string;
  nextHour: number;
  nextSlotSessions: number;
  medianSlotSessions: number;
  rushIndex: number;
  isUpcomingRush: boolean;
  liveOccupancy: number;
  suggestedWaiters: number;
  rushAlert: boolean;
  staffingAlert: boolean;
};

export function medianSlotSessions(priors: LocationRhythmPriorsJson): number {
  const values = Object.values(priors.slots)
    .map((slot) => slot.sampleSessions)
    .filter((count) => count > 0)
    .sort((a, b) => a - b);

  if (values.length === 0) return 0;
  return values[Math.floor(values.length / 2)] ?? 0;
}

export function computeRushIndex(
  slotSessions: number,
  medianSessions: number
): number {
  if (slotSessions <= 0 || medianSessions <= 0) return 0;
  return Math.round((slotSessions / medianSessions) * 100) / 100;
}

/** Pure ops alert evaluation — ADR-042 VRP-P4. */
export function evaluateRhythmOpsAlerts(input: {
  priors: LocationRhythmPriorsJson;
  localDow: number;
  localHour: number;
  localMinute: number;
  minSampleSessions: number;
  rushThreshold: number;
  rushAlerts: boolean;
  staffingHints: boolean;
  activeSessions: number;
  totalSeats: number;
  targetSessionsPerWaiter: number;
  staffingOccupancyThreshold?: number;
}): RhythmOpsEvaluation | null {
  if (input.localMinute !== 30) {
    return null;
  }

  const next = nextLocalSlot(input.localDow, input.localHour);
  const nextSlotKey = rhythmSlotKey(next.dow, next.hour);
  const nextSlot = input.priors.slots[nextSlotKey];
  const nextSlotSessions = nextSlot?.sampleSessions ?? 0;
  const median = medianSlotSessions(input.priors);
  const rushIndex = computeRushIndex(nextSlotSessions, median);
  const meetsRushThreshold =
    nextSlotSessions >= input.minSampleSessions &&
    rushIndex >= input.rushThreshold;

  const totalSeats = Math.max(1, input.totalSeats);
  const liveOccupancy =
    Math.round((input.activeSessions / totalSeats) * 100) / 100;
  const occupancyThreshold = input.staffingOccupancyThreshold ?? 0.55;
  const forecastLoad = Math.max(input.activeSessions, nextSlotSessions);
  const suggestedWaiters = Math.max(
    1,
    Math.ceil(forecastLoad / Math.max(1, input.targetSessionsPerWaiter))
  );

  const rushAlert = input.rushAlerts && meetsRushThreshold;
  const staffingAlert =
    input.staffingHints &&
    meetsRushThreshold &&
    liveOccupancy >= occupancyThreshold;

  if (!rushAlert && !staffingAlert) {
    return null;
  }

  return {
    nextSlotKey,
    nextHour: next.hour,
    nextSlotSessions,
    medianSlotSessions: median,
    rushIndex,
    isUpcomingRush: meetsRushThreshold,
    liveOccupancy,
    suggestedWaiters,
    rushAlert,
    staffingAlert,
  };
}
