"use client";

import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { CinematicDashboardShowcase } from "@/components/landing/cinematic-dashboard-showcase";
import {
  LandingSystemZone,
  SystemLiveMeta,
} from "@/components/landing/landing-system-zone";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ShowcasePhone, ShowcaseWindow } from "@/components/landing/showcase-frame";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";

function GuestChannelSurface() {
  return (
    <div className="flex min-h-[520px] items-center justify-center px-8 py-16 sm:min-h-[580px] lg:justify-start lg:pl-[12%]">
      <ShowcasePhone presentation="float" hideLabel className="max-w-[260px] sm:max-w-[280px]">
        <ScaledPhonePreview designWidth={280} designHeight={480}>
          <GuestMenuContent variant="cinematic" />
        </ScaledPhonePreview>
      </ShowcasePhone>
    </div>
  );
}

function FloorSurface() {
  return (
    <div className="relative min-h-[520px] w-full overflow-hidden sm:min-h-[580px]">
      <ShowcaseWindow presentation="cinematic" className="size-full min-h-[520px] sm:min-h-[580px]">
        <CinematicDashboardShowcase story="floor" />
      </ShowcaseWindow>
    </div>
  );
}

function DenisSurface() {
  return (
    <div className="flex min-h-[520px] items-center justify-center px-8 py-16 sm:min-h-[580px] lg:justify-end lg:pr-[12%]">
      <AiConciergeShowcase hideLabel presentation="float" />
    </div>
  );
}

/** One operational story per scroll — immersion, not feature tour. */
export function LandingSystemZones() {
  return (
    <div id="operations" className="scroll-mt-14">
      <LandingSystemZone
        id="guest-channel"
        label="Guest ordering"
        meta={<SystemLiveMeta label="Table 8" />}
      >
        <GuestChannelSurface />
      </LandingSystemZone>

      <LandingSystemZone
        id="floor-awareness"
        label="Floor awareness"
        meta={<SystemLiveMeta label="Skyline Lounge" />}
      >
        <FloorSurface />
      </LandingSystemZone>

      <LandingSystemZone
        id="embedded-intelligence"
        label="Embedded intelligence"
        meta={<SystemLiveMeta label="Denis" />}
      >
        <DenisSurface />
      </LandingSystemZone>
    </div>
  );
}
