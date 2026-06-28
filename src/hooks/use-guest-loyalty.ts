"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoyaltyProfileView } from "@/lib/denis/commerce/loyalty/loyalty-store";
import {
  buildNextLevelProgress,
  detectLevelUp,
  resolveGuestLevel,
  type GuestLevelId,
} from "@/lib/denis/commerce/loyalty/guest-level";

type LoyaltyApiProfile = LoyaltyProfileView & {
  levelUpEvent?: { newLevel: GuestLevelId; celebrationMessage: string } | null;
};

export function useGuestLoyalty(input: {
  locationId: string;
  guestToken: string;
  enabled?: boolean;
}) {
  const [profile, setProfile] = useState<LoyaltyApiProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState<{
    newLevel: GuestLevelId;
    message: string;
  } | null>(null);
  const seenLevelRef = useRef<GuestLevelId | null>(null);

  const refresh = useCallback(async () => {
    if (!input.enabled || !input.locationId || !input.guestToken) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        locationId: input.locationId,
        guestToken: input.guestToken,
      });
      const res = await fetch(`/api/commerce/loyalty?${params.toString()}`);
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { profile: LoyaltyApiProfile | null };
      };
      if (!json.ok || !json.data?.profile) {
        setProfile(null);
        return;
      }

      const next = json.data.profile;
      setProfile(next);

      const previous = seenLevelRef.current;
      if (previous != null && next.guestLevel > previous) {
        const event = detectLevelUp(previous, {
          visitCount: next.visitCount,
          totalSpent: next.totalSpent,
        });
        if (event) {
          setCelebration({
            newLevel: event.newLevel,
            message: event.celebrationMessage,
          });
        }
      }
      seenLevelRef.current = next.guestLevel;
    } catch {
      /* guest UI degrades silently */
    } finally {
      setLoading(false);
    }
  }, [input.enabled, input.locationId, input.guestToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const progress = profile
    ? buildNextLevelProgress({
        visitCount: profile.visitCount,
        totalSpent: profile.totalSpent,
      })
    : null;

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return {
    profile,
    progress,
    level: profile
      ? resolveGuestLevel({
          visitCount: profile.visitCount,
          totalSpent: profile.totalSpent,
        })
      : null,
    loading,
    celebration,
    dismissCelebration,
    refresh,
  };
}
