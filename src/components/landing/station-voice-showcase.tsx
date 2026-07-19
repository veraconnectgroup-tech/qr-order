"use client";

import { DenisVoiceOrb } from "@/components/denis-voice-orb";

/**
 * ADR-053 (station voice) — the existing WebGL voice orb
 * (src/components/denis-voice-orb.tsx, already live in the real
 * station-voice UI), carried over into the landing page mockup as-is —
 * rotating, particle-lit, bloom-glowing, idling without a mic source.
 * No added copy or elements beyond the orb itself; the orb's own shader
 * (dark ground, orange energy ribbons) is untouched — it was tuned live
 * with the founder against a reference image and is shared with the
 * real product UI, not something to redesign just for marketing.
 *
 * Presentation, fourteenth pass: plain black-circle-on-white inside a
 * thin black-bordered rounded card was confirmed as a real improvement
 * ("puno bolje"). Founder's next ask: give the black shape itself some
 * life — "like water spilling over." Kept the goo-filter metaball
 * (satellites detaching/re-fusing into the main mass) — founder
 * confirmed that direction is right, just asked for the main mass
 * itself to move more unevenly/irregularly ("da se krug malo vise
 * pomera neravnomerno") rather than staying close to a perfect circle
 * at rest. `.landing-liquid-sway` (globals.css) now has a visibly wider
 * border-radius range for exactly that.
 */
export function StationVoiceShowcase() {
  const orbSize = 380;
  const satellites = [
    { top: "10%", left: "14%", size: 0.16, dx: "-55px", dy: "-42px", duration: "9s", delay: "0s" },
    { top: "62%", left: "84%", size: 0.13, dx: "48px", dy: "38px", duration: "7.5s", delay: "-3s" },
    { top: "78%", left: "20%", size: 0.11, dx: "-40px", dy: "46px", duration: "8.4s", delay: "-1.4s" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[560px] rounded-[2rem] border-2 border-black/85 px-10 py-14">
      <div className="relative flex items-center justify-center">
        {/* Inline, zero-size SVG carrying only the goo filter definition
            — never rendered itself, just referenced via filter: url(). */}
        <svg width="0" height="0" aria-hidden focusable="false">
          <defs>
            <filter id="denis-liquid-goo" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -7.5"
              />
            </filter>
          </defs>
        </svg>

        {/* No negative z-index here on purpose — a negative z-index on a
            positioned element falls behind the *page* background whenever
            an ancestor doesn't establish its own stacking context (none
            of FeatureRow's wrapper divs set z-index), not just behind
            its siblings. DOM order alone (this paints before the orb
            below, both at the default "auto" stacking level) keeps it
            visible behind it without that pitfall. */}
        <div
          className="landing-liquid-blob pointer-events-none absolute"
          style={{
            width: orbSize * 0.97,
            height: orbSize * 0.97,
            filter: "url(#denis-liquid-goo)",
          }}
          aria-hidden
        >
          <div className="landing-liquid-sway absolute inset-0 bg-black" />
          {satellites.map((sat, i) => (
            <div
              key={i}
              className="landing-liquid-satellite"
              style={
                {
                  top: sat.top,
                  left: sat.left,
                  width: orbSize * sat.size,
                  height: orbSize * sat.size,
                  animationDuration: sat.duration,
                  animationDelay: sat.delay,
                  "--sat-dx": sat.dx,
                  "--sat-dy": sat.dy,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <DenisVoiceOrb size={orbSize} />
      </div>
    </div>
  );
}
