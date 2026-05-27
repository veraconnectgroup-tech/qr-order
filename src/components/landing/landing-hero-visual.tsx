"use client";

import { CinematicDashboardShowcase } from "@/components/landing/cinematic-dashboard-showcase";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import {
  ShowcaseAmbientStage,
  ShowcaseCropFrame,
  ShowcaseFloatDevice,
} from "@/components/landing/showcase-composition";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import {
  ShowcasePhone,
  ShowcaseStage,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";
import { cn } from "@/lib/utils";

function HeroOperationalCanvas() {
  return (
    <>
      <div className="absolute right-[-8%] top-[-4%] z-10 h-full w-[112%] origin-top-left scale-[1.06] sm:right-[-6%] sm:scale-[1.04] lg:scale-[1.02]">
        <ShowcaseWindow presentation="cinematic">
          <CinematicDashboardShowcase story="live-orders" />
        </ShowcaseWindow>
      </div>

      <ShowcaseFloatDevice className="bottom-[22%] left-[4%] w-[30%] max-w-[172px] md:bottom-[24%]">
        <ShowcasePhone presentation="float" hideLabel className="max-w-none">
          <ScaledPhonePreview designWidth={280} designHeight={480}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </ShowcaseFloatDevice>
    </>
  );
}

/** Hero: full operational canvas — quietly alive. */
export function LandingHeroVisual({
  className,
  fullBleed = false,
}: {
  className?: string;
  fullBleed?: boolean;
}) {
  if (fullBleed) {
    return (
      <div
        className={cn(
          "relative size-full min-h-[inherit] overflow-hidden bg-[#09090b]",
          className
        )}
      >
        <HeroOperationalCanvas />
      </div>
    );
  }

  return (
    <ShowcaseStage
      className={cn(
        "mx-auto w-full max-w-none overflow-hidden bg-[#09090b] sm:min-h-[480px] lg:min-h-[540px]",
        className
      )}
    >
      <HeroOperationalCanvas />
    </ShowcaseStage>
  );
}

/** Cropped operational surface for legacy embeds. */
export function FeatureShowcase({
  children,
  aspect = "16/11",
  className,
  cropClassName,
}: {
  url?: string;
  children: React.ReactNode;
  aspect?: string;
  className?: string;
  cropClassName?: string;
}) {
  return (
    <ShowcaseAmbientStage className={className}>
      <ShowcaseCropFrame aspect={aspect} innerClassName={cropClassName}>
        <ShowcaseWindow presentation="cinematic">{children}</ShowcaseWindow>
      </ShowcaseCropFrame>
    </ShowcaseAmbientStage>
  );
}
