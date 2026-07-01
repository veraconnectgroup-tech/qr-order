"use client";

import { cn } from "@/lib/utils";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";
import { LoyaltyBadge } from "@/components/guest/loyalty-badge";

type Props = {
  level: GuestLevelId;
  levelName: string;
  progressPercent: number;
  visitsRemaining: number;
  nextLevelName?: string | null;
  pointsBalance: number;
  streakLabel?: string;
  className?: string;
};

export function LoyaltyProgress({
  level,
  levelName,
  progressPercent,
  visitsRemaining,
  nextLevelName,
  pointsBalance,
  streakLabel,
  className,
}: Props) {
  const clamped = Math.min(100, Math.max(0, progressPercent));

  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/80 p-4",
        className
      )}
      aria-label="Loyalty progress"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-100">{levelName}</p>
          <p className="text-xs text-zinc-400">{pointsBalance} poena</p>
        </div>
        <LoyaltyBadge level={level} />
      </div>

      {nextLevelName ? (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${nextLevelName}`}
          >
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-200"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {visitsRemaining > 0
              ? `Još ${visitsRemaining} posete do ${nextLevelName}`
              : `Skoro ${nextLevelName}!`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-orange-300">Maksimalni nivo dostignut 👑</p>
      )}

      {streakLabel ? (
        <p className="mt-2 text-xs font-medium text-orange-400">{streakLabel}</p>
      ) : null}
    </section>
  );
}
