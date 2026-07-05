"use client";

import { mixTowardMoodColor, resolveDenisMoodColor } from "./denis-mood-color";
import { cn } from "@/lib/utils";

const WHITE = { r: 255, g: 255, b: 255 };
const NEAR_WHITE = { r: 253, g: 253, b: 253 };

export type DenisVoicePresenceOrbProps = {
  /** 0 = calm, 1 = critical — same signal driving the D-mark and card color. */
  moodIntensity: number;
  /** True while audio is actually playing — orb swells bigger and faster. */
  speaking?: boolean;
  size?: number;
  className?: string;
};

/**
 * Soft glowing voice orb — all paint inline (reliable in modal + blur).
 * Styled after voice-assistant orbs: white cloud core, ember/red mood tint.
 */
export function DenisVoicePresenceOrb({
  moodIntensity,
  speaking = false,
  size = 220,
  className,
}: DenisVoicePresenceOrbProps) {
  const coreWhite = mixTowardMoodColor(WHITE, moodIntensity);
  const coreNearWhite = mixTowardMoodColor(NEAR_WHITE, moodIntensity);
  const highlight = mixTowardMoodColor(WHITE, moodIntensity, 0.95);
  const highlightSoft = mixTowardMoodColor(WHITE, moodIntensity, 0.7);
  const tintStrong = resolveDenisMoodColor(moodIntensity, 0.85);
  const tintMid = resolveDenisMoodColor(moodIntensity, 0.55);
  const tintSoft = resolveDenisMoodColor(
    moodIntensity,
    moodIntensity >= 0.99 ? 1 : 0.2
  );
  const glow = resolveDenisMoodColor(moodIntensity, 0.45);

  return (
    <div
      aria-hidden
      className={cn(
        "denis-voice-orb shrink-0 rounded-full transition-[background,box-shadow] duration-700",
        speaking && "denis-voice-orb--speaking",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `
          radial-gradient(circle at 32% 26%, ${highlight} 0%, ${highlightSoft} 20%, transparent 48%),
          radial-gradient(circle at 68% 34%, ${highlightSoft} 0%, transparent 42%),
          radial-gradient(circle at 60% 78%, ${tintStrong} 0%, transparent 60%),
          radial-gradient(circle at 30% 72%, ${tintMid} 0%, transparent 65%),
          radial-gradient(circle at 50% 50%, ${coreWhite} 0%, ${coreNearWhite} 40%, ${tintSoft} 100%)
        `,
        boxShadow: `0 0 ${Math.round(size * 0.4)}px ${Math.round(size * 0.08)}px ${glow}`,
      }}
    />
  );
}
