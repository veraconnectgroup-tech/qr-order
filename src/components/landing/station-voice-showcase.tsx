"use client";

import { DenisVoiceOrb } from "@/components/denis-voice-orb";

/**
 * ADR-053 (station voice) — first visual on the marketing site for the
 * hands-free listening capability. Reuses the real WebGL voice orb built
 * for guest voice (rotating, particle-lit, bloom-glowing — idles without
 * a mic source, no fake timer-driven pulse) instead of a flat waveform
 * mockup, laid out like retell.ai's voice-agent hero (orb + capability
 * pills) per the founder's explicit reference.
 */
const STATION_VOICE_CAPABILITIES = [
  "86 an item",
  "Announce a delay",
  "Mark table ready",
  "Create a task",
  "Read new bons",
  "What's still open",
];

export function StationVoiceShowcase() {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[1.75rem] border border-[#e7ebf0] bg-white px-6 py-10 shadow-[0_36px_90px_-42px_rgba(22,20,14,0.32)] sm:px-8">
      <div className="flex justify-center">
        <DenisVoiceOrb size={200} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {STATION_VOICE_CAPABILITIES.map((label) => (
          <span
            key={label}
            className="rounded-full bg-[#f4f5f8] px-4 py-2 text-[13px] font-semibold text-[#1f2328]"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] font-medium text-[#8b95a4]">
        Hands-free on the station tablet — staff just talk, Denis answers
        from what is actually happening.
      </p>
    </div>
  );
}
