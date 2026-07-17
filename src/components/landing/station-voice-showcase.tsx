"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { ShowcaseTablet } from "@/components/landing/showcase-frame";

function StaffAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-[12px] font-semibold text-sky-800">
      {initials}
    </div>
  );
}

/** Animated bars standing in for a live mic waveform — no audio, just motion. */
function WaveformBars() {
  const heights = [6, 14, 9, 18, 7, 15, 10];
  return (
    <div className="flex h-5 items-center gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-emerald-500"
          initial={{ height: h }}
          animate={{ height: [h, h * 1.8, h * 0.6, h] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * 0.09,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * ADR-053 (station voice) — first visual on the marketing site for the
 * hands-free listening capability. No component depicting this existed
 * anywhere in landing/ before, despite it being a shipped, differentiated
 * capability (Denis hears a staff member and answers, hands stay free).
 */
export function StationVoiceShowcase() {
  return (
    <ShowcaseTablet url="denis.app/kitchen" hideCaption theme="light">
      <div className="pointer-events-none select-none bg-white">
        <div className="border-b border-[#e7ebf0] bg-[#fbfcfd] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1f2328]">
              Kitchen station
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-normal text-[#6b7280] sm:text-xs">
              Skyline Lounge
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-xs">
              <Mic className="size-3" />
              Listening
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <WaveformBars />
            <span className="text-[11px] font-medium text-[#8b95a4] sm:text-xs">
              Hands stay free — no tap, no screen
            </span>
          </div>
        </div>

        <div className="space-y-3 bg-[#fbfcfd] p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <StaffAvatar name="Marko" />
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#1f2328] shadow-[0_2px_10px_-4px_rgba(31,35,40,0.18)]">
              &quot;Hey Denis — how long on the salmon for table 5?&quot;
            </div>
          </div>

          <div className="flex items-start justify-end gap-2.5">
            <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm bg-[#1f2328] px-3 py-2 text-sm text-white shadow-[0_2px_10px_-4px_rgba(31,35,40,0.28)]">
              6 minutes — sea bass just went out ahead of it. I&apos;ll tell
              Marko the moment it&apos;s up.
            </div>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1f2328] text-[10px] font-semibold text-white">
              D
            </span>
          </div>

          <div className="flex items-center justify-center pt-1">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-[#8b95a4] ring-1 ring-[#e7ebf0]">
              Answered from the live kitchen board — never a guess
            </span>
          </div>
        </div>
      </div>
    </ShowcaseTablet>
  );
}
