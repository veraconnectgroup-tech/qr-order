"use client";

import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { CinematicDashboardShowcase } from "@/components/landing/cinematic-dashboard-showcase";
import {
  LandingSystemZone,
  SystemLiveMeta,
} from "@/components/landing/landing-system-zone";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";

function GuestChannelSurface() {
  return (
    <div className="flex min-h-[440px] items-center justify-center px-6 py-10 sm:min-h-[480px] lg:justify-start lg:pl-[10%] lg:pr-8">
      <div className="translate-y-0.5 -rotate-[0.75deg]">
        <ShowcasePhone presentation="float" hideLabel className="max-w-[250px] sm:max-w-[270px]">
          <ScaledPhonePreview designWidth={280} designHeight={480}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </div>
    </div>
  );
}

function DashboardSurface({
  story,
  minHeight = "min-h-[480px] sm:min-h-[540px]",
}: {
  story: "live-orders" | "floor";
  minHeight?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${minHeight}`}>
      <div className="absolute inset-0 origin-top-left scale-[1.03] sm:scale-[1.01]">
        <ShowcaseWindow presentation="cinematic">
          <CinematicDashboardShowcase story={story} />
        </ShowcaseWindow>
      </div>
    </div>
  );
}

function DenisSurface() {
  return (
    <div className="flex min-h-[440px] items-center justify-center px-6 py-10 sm:min-h-[480px] lg:justify-end lg:pr-[12%] lg:pl-8">
      <div className="-translate-y-0.5 rotate-[0.75deg]">
        <AiConciergeShowcase hideLabel presentation="float" />
      </div>
    </div>
  );
}

/** Continuous operational environments — no feature marketing layout. */
export function LandingSystemZones() {
  return (
    <div id="operations" className="scroll-mt-14">
      <LandingSystemZone
        id="guest-channel"
        index="01"
        label="Guest channel"
        caption="QR · browser · no app install"
        meta={<SystemLiveMeta label="Table 8" />}
      >
        <GuestChannelSurface />
      </LandingSystemZone>

      <LandingSystemZone
        id="live-orders"
        index="02"
        label="Order routing"
        caption="Bar · kitchen · floor sync"
        meta={<SystemLiveMeta />}
      >
        <DashboardSurface story="live-orders" />
      </LandingSystemZone>

      <LandingSystemZone
        id="floor-coordination"
        index="03"
        label="Floor coordination"
        caption="Tables · calls · session state"
        meta={<SystemLiveMeta label="Rooftop" />}
      >
        <DashboardSurface story="floor" />
      </LandingSystemZone>

      <LandingSystemZone
        id="denis-layer"
        index="04"
        label="Denis layer"
        caption="Compliance · guest assistance"
        meta={<SystemLiveMeta label="Operational" />}
      >
        <DenisSurface />
      </LandingSystemZone>
    </div>
  );
}
