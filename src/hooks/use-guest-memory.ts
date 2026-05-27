"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiSheetAllergyId } from "@/lib/ai/guest-sheet-preferences";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  dismissGuestMemoryConsentPrompt,
  fetchGuestMemoryProjection,
  grantGuestMemoryConsentClient,
  isGuestMemoryConsentDismissed,
  syncGuestMemoryClient,
} from "@/lib/guest/denis-guest-memory-client";
import {
  readGuestMemory,
  recordGuestVisit,
  saveGuestAllergies,
  type GuestMemoryProfile,
} from "@/lib/guest/guest-memory-storage";

type DenisGuestMemoryOptions = {
  enabled: boolean;
  tableId: string;
  sessionToken: string | null;
  deviceFingerprint: string;
  language: string;
};

export function useGuestMemory(
  locationId: string,
  denis?: DenisGuestMemoryOptions
) {
  const [profile, setProfile] = useState<GuestMemoryProfile>(() =>
    readGuestMemory(locationId)
  );
  const [serverProjection, setServerProjection] =
    useState<GuestMemoryProjection | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  const canUseDenis =
    denis?.enabled &&
    Boolean(denis.sessionToken) &&
    (denis.deviceFingerprint?.length ?? 0) >= 8;

  useEffect(() => {
    if (!canUseDenis || !denis?.sessionToken) return;

    let cancelled = false;

    void fetchGuestMemoryProjection({
      locationId,
      tableId: denis.tableId,
      sessionToken: denis.sessionToken,
      deviceFingerprint: denis.deviceFingerprint,
    }).then((projection) => {
      if (cancelled) return;
      setServerProjection(projection);
      setShowConsent(
        !projection && !isGuestMemoryConsentDismissed(locationId)
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    canUseDenis,
    denis?.deviceFingerprint,
    denis?.sessionToken,
    denis?.tableId,
    locationId,
  ]);

  const hasServerConsent = serverProjection != null;

  const saveAllergies = useCallback(
    (allergies: string[], allergySheetIds: AiSheetAllergyId[]) => {
      setProfile(saveGuestAllergies(locationId, allergies, allergySheetIds));
      if (canUseDenis && hasServerConsent && denis?.sessionToken) {
        void syncGuestMemoryClient({
          locationId,
          tableId: denis.tableId,
          sessionToken: denis.sessionToken,
          deviceFingerprint: denis.deviceFingerprint,
          sync: { allergyLabels: allergies, allergySheetIds },
        }).then((projection) => {
          if (projection) setServerProjection(projection);
        });
      }
    },
    [canUseDenis, denis, hasServerConsent, locationId]
  );

  const recordVisit = useCallback(
    (itemNames: string[]) => {
      setProfile(recordGuestVisit(locationId, itemNames));
      if (canUseDenis && hasServerConsent && denis?.sessionToken) {
        void syncGuestMemoryClient({
          locationId,
          tableId: denis.tableId,
          sessionToken: denis.sessionToken,
          deviceFingerprint: denis.deviceFingerprint,
          recordVisit: { itemNames },
        }).then((projection) => {
          if (projection) setServerProjection(projection);
        });
      }
    },
    [canUseDenis, denis, hasServerConsent, locationId]
  );

  const acceptConsent = useCallback(async () => {
    if (!canUseDenis || !denis?.sessionToken) return;
    const projection = await grantGuestMemoryConsentClient({
      locationId,
      tableId: denis.tableId,
      sessionToken: denis.sessionToken,
      deviceFingerprint: denis.deviceFingerprint,
      scopes: ["favorites", "allergies", "language"],
      sync: {
        lastVisitItemNames: profile.lastVisitItems,
        allergyLabels: profile.allergies,
        allergySheetIds: profile.allergySheetIds,
        preferredLanguage: denis.language,
      },
    });
    if (projection) {
      setServerProjection(projection);
      setShowConsent(false);
    }
  }, [canUseDenis, denis, locationId, profile]);

  const declineConsent = useCallback(() => {
    dismissGuestMemoryConsentPrompt(locationId);
    setShowConsent(false);
  }, [locationId]);

  const lastVisitItems = useMemo(() => {
    if (serverProjection?.lastVisitItemNames.length) {
      return serverProjection.lastVisitItemNames;
    }
    return profile.lastVisitItems;
  }, [profile.lastVisitItems, serverProjection]);

  const isReturning =
    lastVisitItems.length > 0 &&
    (serverProjection
      ? serverProjection.visitCount > 0
      : profile.lastVisitAt != null);

  const hasKnownAllergies = profile.allergySheetIds.length > 0;

  return {
    profile,
    isReturning,
    lastVisitItems,
    hasKnownAllergies,
    knownAllergies: profile.allergies,
    knownAllergySelection: profile.allergySheetIds,
    saveAllergies,
    recordVisit,
    showMemoryConsent: canUseDenis && showConsent,
    acceptMemoryConsent: acceptConsent,
    declineMemoryConsent: declineConsent,
    hasServerConsent,
  };
}
