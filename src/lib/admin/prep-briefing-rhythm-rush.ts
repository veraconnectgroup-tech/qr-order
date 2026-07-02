import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import {
  rhythmSlotKey,
  slotStressFromRushIndex,
} from "@/lib/denis/config/resolve-rhythm-priors";

/** Hourly slots at or above this stress appear in prep briefing rush expectation. */
export const RHYTHM_RUSH_BRIEFING_STRESS = new Set(["busy", "high", "rush"]);

function rushIndexForSlot(
  slot: { sampleSessions: number },
  priors: LocationRhythmPriorsJson,
  minSampleSessions: number
): number {
  const vsMin = slot.sampleSessions / Math.max(1, minSampleSessions);
  const populated = Object.values(priors.slots).filter(
    (entry) => entry.sampleSessions > 0
  );
  if (populated.length <= 1) return vsMin;

  const sorted = populated
    .map((entry) => entry.sampleSessions)
    .sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? minSampleSessions;
  const vsMedian = slot.sampleSessions / Math.max(1, median);
  return Math.max(vsMedian, vsMin);
}

/** Deterministic hourly rush expectation from ADR-042 rhythm priors. */
export function buildRhythmRushHourLines(input: {
  priors: LocationRhythmPriorsJson | null;
  weekday: number;
  minSampleSessions?: number;
}): string[] {
  if (!input.priors) return [];

  const minSample = input.minSampleSessions ?? 8;
  const rushHours: number[] = [];

  for (let hour = 10; hour <= 23; hour += 1) {
    const slot = input.priors.slots[rhythmSlotKey(input.weekday, hour)];
    if (!slot || slot.sampleSessions <= 0) continue;
    const stress = slotStressFromRushIndex(
      rushIndexForSlot(slot, input.priors, minSample)
    );
    if (RHYTHM_RUSH_BRIEFING_STRESS.has(stress)) {
      rushHours.push(hour);
    }
  }

  if (rushHours.length === 0) return [];

  const ranges: string[] = [];
  let start = rushHours[0]!;
  let prev = rushHours[0]!;

  for (let i = 1; i < rushHours.length; i += 1) {
    const hour = rushHours[i]!;
    if (hour === prev + 1) {
      prev = hour;
      continue;
    }
    ranges.push(
      start === prev ? `${start}:00` : `${start}:00–${prev + 1}:00`
    );
    start = hour;
    prev = hour;
  }
  ranges.push(start === prev ? `${start}:00` : `${start}:00–${prev + 1}:00`);

  return [`Gužva po satu (rhythm): ${ranges.join(", ")}`];
}
