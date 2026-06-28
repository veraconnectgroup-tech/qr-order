"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LoyaltyBadge } from "@/components/guest/loyalty-badge";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";

type Props = {
  newLevel: GuestLevelId;
  message: string;
  onDismiss: () => void;
  className?: string;
};

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${(i * 17) % 100}%`,
    delay: `${(i % 6) * 0.05}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    rotate: `${(i * 37) % 360}deg`,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 size-2 animate-[confetti-fall_1.2s_ease-out_forwards] rounded-sm opacity-90"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

export function LevelUpCelebration({
  newLevel,
  message,
  onDismiss,
  className,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm",
        className
      )}
      role="dialog"
      aria-live="polite"
      aria-label="Level up celebration"
    >
      <div className="relative overflow-hidden rounded-2xl border border-orange-500/40 bg-zinc-900 p-5 shadow-2xl">
        <ConfettiBurst />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <LoyaltyBadge level={newLevel} showLabel={false} className="text-base" />
          <p className="text-lg font-semibold text-zinc-50">{message}</p>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className="mt-1 min-h-12 rounded-xl bg-orange-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
          >
            Super! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
