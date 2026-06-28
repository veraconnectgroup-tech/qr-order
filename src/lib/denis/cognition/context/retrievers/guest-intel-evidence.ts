import {
  formatGuestHistoryBlock,
  guestMemoryPersonalizationAllowed,
} from "@/lib/denis/platform/guest-memory-format";
import {
  normalizeGuestMemoryProjection,
  type GuestMemoryProjection,
} from "@/lib/denis/platform/guest-memory-types";

/** Consented return-guest projection for situation pack. */
export function retrieveGuestIntelEvidence(
  memory: GuestMemoryProjection | null | undefined
): string {
  if (!memory) return "";
  if (!guestMemoryPersonalizationAllowed(memory)) return "";

  const guest = normalizeGuestMemoryProjection(memory);
  if (guest.visitCount <= 0 && guest.allergies.length === 0) {
    return "";
  }

  return formatGuestHistoryBlock(guest);
}
