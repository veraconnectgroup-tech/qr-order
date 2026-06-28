import type { AiSheetAllergyId } from "@/lib/ai/guest-sheet-preferences";
import {
  defaultGuestMemory,
  guestMemoryStorageKey,
  readGuestMemory,
  recordGuestVisit,
  saveGuestAllergies,
  writeGuestMemory,
  type GuestMemoryProfile,
} from "@/lib/guest/guest-memory-storage";

export type DenisGuestMemoryLocal = GuestMemoryProfile & {
  preferredLanguage: string | null;
};

const LANGUAGE_SUFFIX = ":lang";

function readLanguage(locationId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${guestMemoryStorageKey(locationId)}${LANGUAGE_SUFFIX}`);
  } catch {
    return null;
  }
}

function writeLanguage(locationId: string, language: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = `${guestMemoryStorageKey(locationId)}${LANGUAGE_SUFFIX}`;
    if (!language?.trim()) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, language.trim());
  } catch {
    // ignore quota errors
  }
}

/** Read consented guest memory from localStorage (M17). */
export function readDenisGuestMemoryLocal(
  locationId: string
): DenisGuestMemoryLocal {
  const profile = readGuestMemory(locationId);
  return {
    ...profile,
    preferredLanguage: readLanguage(locationId),
  };
}

export function writeDenisGuestMemoryLocal(
  locationId: string,
  profile: DenisGuestMemoryLocal
) {
  const { preferredLanguage, ...base } = profile;
  writeGuestMemory(locationId, base);
  writeLanguage(locationId, preferredLanguage);
}

export function saveDenisGuestLanguage(locationId: string, language: string) {
  writeLanguage(locationId, language);
}

export function recordDenisGuestVisit(
  locationId: string,
  itemNames: string[]
): DenisGuestMemoryLocal {
  const profile = recordGuestVisit(locationId, itemNames);
  return {
    ...profile,
    preferredLanguage: readLanguage(locationId),
  };
}

export function saveDenisGuestAllergies(
  locationId: string,
  allergies: string[],
  allergySheetIds: AiSheetAllergyId[]
): DenisGuestMemoryLocal {
  const profile = saveGuestAllergies(locationId, allergies, allergySheetIds);
  return {
    ...profile,
    preferredLanguage: readLanguage(locationId),
  };
}

export function isDenisReturningGuest(locationId: string): boolean {
  const memory = readDenisGuestMemoryLocal(locationId);
  return memory.lastVisitItems.length > 0 && memory.lastVisitAt != null;
}

export { defaultGuestMemory };
