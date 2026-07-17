"use client";

import { DenisVoiceOrb } from "@/components/denis-voice-orb";

/**
 * ADR-053 (station voice) — the existing WebGL voice orb
 * (src/components/denis-voice-orb.tsx, already live in the real
 * station-voice UI), carried over into the landing page mockup as-is —
 * rotating, particle-lit, bloom-glowing, idling without a mic source.
 * No added copy or elements beyond the orb itself.
 */
export function StationVoiceShowcase() {
  return (
    <div className="mx-auto flex w-full max-w-[420px] justify-center rounded-[1.75rem] border border-[#e7ebf0] bg-white px-6 py-10 shadow-[0_36px_90px_-42px_rgba(22,20,14,0.32)] sm:px-8">
      <DenisVoiceOrb size={200} />
    </div>
  );
}
