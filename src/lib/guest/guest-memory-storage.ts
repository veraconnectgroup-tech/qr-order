import type { AiSheetAllergyId } from "@/lib/ai/guest-sheet-preferences";

export type GuestVisitRecord = {
  at: number;
  items: string[];
};

export type GuestMemoryProfile = {
  allergies: string[];
  allergySheetIds: AiSheetAllergyId[];
  favorites: string[];
  lastVisitItems: string[];
  lastVisitAt: number | null;
  visitHistory: GuestVisitRecord[];
};

const MAX_FAVORITES = 12;
const MAX_HISTORY = 8;

export function defaultGuestMemory(): GuestMemoryProfile {
  return {
    allergies: [],
    allergySheetIds: [],
    favorites: [],
    lastVisitItems: [],
    lastVisitAt: null,
    visitHistory: [],
  };
}

export function guestMemoryStorageKey(locationId: string) {
  return `guest-memory-${locationId}`;
}

export function readGuestMemory(locationId: string): GuestMemoryProfile {
  if (typeof window === "undefined") return defaultGuestMemory();
  try {
    const raw = localStorage.getItem(guestMemoryStorageKey(locationId));
    if (!raw) return defaultGuestMemory();
    const parsed = JSON.parse(raw) as Partial<GuestMemoryProfile>;
    return {
      ...defaultGuestMemory(),
      ...parsed,
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
      allergySheetIds: Array.isArray(parsed.allergySheetIds)
        ? parsed.allergySheetIds
        : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      lastVisitItems: Array.isArray(parsed.lastVisitItems)
        ? parsed.lastVisitItems
        : [],
      lastVisitAt:
        typeof parsed.lastVisitAt === "number" ? parsed.lastVisitAt : null,
      visitHistory: Array.isArray(parsed.visitHistory)
        ? parsed.visitHistory
        : [],
    };
  } catch {
    return defaultGuestMemory();
  }
}

export function writeGuestMemory(
  locationId: string,
  profile: GuestMemoryProfile
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      guestMemoryStorageKey(locationId),
      JSON.stringify(profile)
    );
  } catch {
    // ignore quota errors
  }
}

function mergeGuestMemory(
  locationId: string,
  updater: (current: GuestMemoryProfile) => GuestMemoryProfile
): GuestMemoryProfile {
  const next = updater(readGuestMemory(locationId));
  writeGuestMemory(locationId, next);
  return next;
}

export function recordGuestVisit(
  locationId: string,
  itemNames: string[]
): GuestMemoryProfile {
  const items = [...new Set(itemNames.filter(Boolean))];
  if (!items.length) return readGuestMemory(locationId);

  return mergeGuestMemory(locationId, (current) => ({
    ...current,
    favorites: [...new Set([...items, ...current.favorites])].slice(
      0,
      MAX_FAVORITES
    ),
    lastVisitItems: items,
    lastVisitAt: Date.now(),
    visitHistory: [{ at: Date.now(), items }, ...current.visitHistory].slice(
      0,
      MAX_HISTORY
    ),
  }));
}

export function saveGuestAllergies(
  locationId: string,
  allergies: string[],
  allergySheetIds: AiSheetAllergyId[]
): GuestMemoryProfile {
  return mergeGuestMemory(locationId, (current) => ({
    ...current,
    allergies,
    allergySheetIds,
  }));
}
