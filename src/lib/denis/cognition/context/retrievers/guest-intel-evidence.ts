import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

/** `guest.memory` pointer — consented return-guest projection. */
export function retrieveGuestIntelEvidence(
  memory: GuestMemoryProjection | null | undefined
): string {
  if (!memory) return "";

  const lines: string[] = [];

  if (memory.visitCount > 1) {
    lines.push(`Return guest (visits: ${memory.visitCount})`);
  }

  if (memory.preferredLanguage) {
    lines.push(`Preferred language: ${memory.preferredLanguage}`);
  }

  if (memory.allergyLabels.length > 0) {
    lines.push(`Known allergies: ${memory.allergyLabels.join(", ")}`);
  }

  if (memory.lastVisitItemNames.length > 0) {
    lines.push(
      `Last visit ordered: ${memory.lastVisitItemNames.slice(0, 5).join(", ")}`
    );
  }

  if (memory.favoriteProductIds.length > 0) {
    lines.push(
      `Favorite product IDs: ${memory.favoriteProductIds.slice(0, 8).join(", ")}`
    );
  }

  if (!lines.length) return "";

  return `GUEST MEMORY:\n${lines.join("\n")}`;
}
