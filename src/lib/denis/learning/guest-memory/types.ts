export type {
  GuestMemoryConsent,
  GuestMemoryProjection,
  GuestMemoryScope,
  GuestMemorySyncPayload,
} from "@/lib/denis/platform/guest-memory-types";

import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { MenuGuestMemoryProjection } from "@/lib/denis/intelligence/menu-personalization";

/** Map consented guest memory to menu personalization input (Q3). */
export function toMenuGuestMemoryProjection(
  guest: GuestMemoryProjection | null | undefined
): MenuGuestMemoryProjection | null {
  if (!guest) return null;

  return {
    favoriteProductIds: guest.favoriteProductIds,
    visitCount: guest.visitCount,
    lastVisitItemNames:
      guest.lastVisitItemNames.length > 0
        ? guest.lastVisitItemNames
        : guest.favoriteItems,
    allergyLabels: guest.allergyLabels.length
      ? guest.allergyLabels
      : guest.allergies,
  };
}
