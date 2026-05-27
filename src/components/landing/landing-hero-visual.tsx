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

/** Hero: photographed operational moment — partial surface, vast space. */
export function LandingHeroVisual() {
  return (
    <ShowcaseStage className="mx-auto w-full max-w-none overflow-hidden bg-[#09090b] sm:min-h-[480px] lg:min-h-[560px] xl:min-h-[600px]">
      <div className="absolute right-[-22%] top-[-18%] z-10 w-[135%] origin-top-left scale-[1.34] sm:right-[-20%] sm:top-[-16%] sm:w-[130%] sm:scale-[1.3] lg:scale-[1.26]">
        <ShowcaseWindow presentation="cinematic">
          <CinematicDashboardShowcase story="live-orders" />
        </ShowcaseWindow>
      </div>

      <ShowcaseFloatDevice>
        <ShowcasePhone presentation="float" hideLabel className="max-w-none">
          <ScaledPhonePreview designWidth={280} designHeight={420}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </ShowcaseFloatDevice>
    </ShowcaseStage>
  );
}

/** Feature sections: one cropped editorial surface each. */
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
