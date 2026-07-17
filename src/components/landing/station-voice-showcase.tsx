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
    <div className="mx-auto flex w-full max-w-[480px] justify-center rounded-[1.75rem] border border-white/[0.08] bg-[#09090b] px-6 py-14 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] sm:px-8">
      <DenisVoiceOrb size={280} />
    </div>
  );
}
