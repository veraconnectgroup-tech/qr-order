"use client";

import { resolveDenisMoodColor } from "./denis-mood-color";
import { cn } from "@/lib/utils";

export type DenisVoicePresenceOrbProps = {
  /** 0 = calm, 1 = critical — same signal driving the D-mark and card color. */
  moodIntensity: number;
  size?: number;
  className?: string;
};

/** Large soft "speaking" orb for kitchen/bar stations — white core fading to Denis's mood color. */
export function DenisVoicePresenceOrb({
  moodIntensity,
  size = 96,
  className,
}: DenisVoicePresenceOrbProps) {
  const edgeColor = resolveDenisMoodColor(moodIntensity, 0.9);
  const midColor = resolveDenisMoodColor(moodIntensity, 0.5);

  return (
    <div
      aria-hidden
      className={cn(
        "denis-voice-orb shrink-0 rounded-full transition-[background] duration-700",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${midColor} 55%, ${edgeColor} 100%)`,
      }}
    />
  );
}
