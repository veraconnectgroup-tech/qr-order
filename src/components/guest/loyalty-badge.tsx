"use client";

import { cn } from "@/lib/utils";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";
import { GUEST_LEVELS } from "@/lib/denis/commerce/loyalty/guest-level";

type Props = {
  level: GuestLevelId;
  className?: string;
  showLabel?: boolean;
};

export function LoyaltyBadge({ level, className, showLabel = true }: Props) {
  const def = GUEST_LEVELS.find((row) => row.id === level) ?? GUEST_LEVELS[0]!;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-200",
        className
      )}
      aria-label={`Loyalty level: ${def.name}`}
    >
      <span aria-hidden>{def.badge}</span>
      {showLabel ? <span>{def.badgeLabel}</span> : null}
    </span>
  );
}
