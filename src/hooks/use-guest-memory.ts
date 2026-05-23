"use client";

import { useCallback, useState } from "react";
import type { AiSheetAllergyId } from "@/lib/ai/guest-sheet-preferences";
import {
  readGuestMemory,
  recordGuestVisit,
  saveGuestAllergies,
  type GuestMemoryProfile,
} from "@/lib/guest/guest-memory-storage";

export function useGuestMemory(locationId: string) {
  const [profile, setProfile] = useState<GuestMemoryProfile>(() =>
    readGuestMemory(locationId)
  );

  const saveAllergies = useCallback(
    (allergies: string[], allergySheetIds: AiSheetAllergyId[]) => {
      setProfile(saveGuestAllergies(locationId, allergies, allergySheetIds));
    },
    [locationId]
  );

  const recordVisit = useCallback(
    (itemNames: string[]) => {
      setProfile(recordGuestVisit(locationId, itemNames));
    },
    [locationId]
  );

  const isReturning =
    profile.lastVisitAt != null && profile.lastVisitItems.length > 0;

  const hasKnownAllergies = profile.allergySheetIds.length > 0;

  return {
    profile,
    isReturning,
    hasKnownAllergies,
    knownAllergies: profile.allergies,
    knownAllergySelection: profile.allergySheetIds,
    saveAllergies,
    recordVisit,
  };
}
