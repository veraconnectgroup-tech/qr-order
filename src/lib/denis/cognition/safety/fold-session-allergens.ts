import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import {
  mergeAllergieLabelSets,
  parseAllergenExclusionsFromText,
} from "@/lib/denis/cognition/safety/allergy-guard";
import type { AllergenId } from "@/lib/allergens";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

/** Merge consented memory + chat-detected allergens for the active session (F2). */
export function foldSessionGuestAllergies(input: {
  timeline: DenisTimelineRow[];
  memory: GuestMemoryProjection | null;
}): string[] {
  const detected = new Set<string>();

  for (const row of input.timeline) {
    const text = guestTextFromTimeline(row);
    if (!text) continue;
    for (const id of parseAllergenExclusionsFromText(text)) {
      detected.add(id);
    }
  }

  return mergeAllergieLabelSets(input.memory?.allergyLabels ?? [], [
    ...detected,
  ] as AllergenId[]);
}

export function withSessionAllergieLabels(
  memory: GuestMemoryProjection | null,
  allergyLabels: string[]
): GuestMemoryProjection | null {
  if (!memory && allergyLabels.length === 0) return null;
  if (!memory) {
    return emptyGuestMemoryProjection({ allergyLabels });
  }

  return {
    ...memory,
    allergyLabels,
  };
}
