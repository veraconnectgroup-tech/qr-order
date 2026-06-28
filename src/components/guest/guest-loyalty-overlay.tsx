"use client";

import { LevelUpCelebration } from "@/components/guest/level-up-celebration";
import { LoyaltyProgress } from "@/components/guest/loyalty-progress";
import { useGuestLoyalty } from "@/hooks/use-guest-loyalty";
import { useReferralCapture } from "@/hooks/use-referral-capture";

type Props = {
  locationId: string;
  guestToken: string;
  enabled?: boolean;
  showProgress?: boolean;
};

export function GuestLoyaltyOverlay({
  locationId,
  guestToken,
  enabled = true,
  showProgress = false,
}: Props) {
  const { profile, progress, celebration, dismissCelebration } = useGuestLoyalty({
    locationId,
    guestToken,
    enabled,
  });

  const { socialProof } = useReferralCapture({
    locationId,
    guestToken,
    enabled,
  });

  if (!enabled) return null;

  return (
    <>
      {socialProof ? (
        <div
          className="mx-4 mb-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-100"
          role="status"
        >
          {socialProof}
        </div>
      ) : null}

      {celebration ? (
        <LevelUpCelebration
          newLevel={celebration.newLevel}
          message={celebration.message}
          onDismiss={dismissCelebration}
        />
      ) : null}

      {showProgress && profile && progress ? (
        <div className="px-4 pb-2">
          <LoyaltyProgress
            level={profile.guestLevel}
            levelName={profile.levelName}
            progressPercent={progress.progressPercent}
            visitsRemaining={progress.visitsRemaining}
            nextLevelName={progress.nextLevel?.name}
            pointsBalance={profile.pointsBalance}
            streakLabel={profile.streakLabel || undefined}
          />
        </div>
      ) : null}
    </>
  );
}
