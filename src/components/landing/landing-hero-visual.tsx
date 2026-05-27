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

/** Hero: one strong operational focal point + physical guest device. */
export function LandingHeroVisual() {
  return (
    <ShowcaseStage className="mx-auto w-full max-w-none overflow-hidden bg-[#09090b] sm:min-h-[480px] lg:min-h-[540px] xl:min-h-[580px]">
      <div className="absolute right-[-10%] top-[-6%] z-10 w-[115%] origin-top-left scale-[1.1] sm:right-[-8%] sm:top-[-5%] sm:w-[112%] sm:scale-[1.08] lg:scale-[1.04]">
        <ShowcaseWindow presentation="cinematic">
          <CinematicDashboardShowcase story="live-orders" />
        </ShowcaseWindow>
      </div>

      <ShowcaseFloatDevice>
        <ShowcasePhone presentation="float" hideLabel className="max-w-none">
          <ScaledPhonePreview designWidth={280} designHeight={460}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </ShowcaseFloatDevice>
    </ShowcaseStage>
  );
}

/** Feature sections: one cropped operational moment each. */
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
