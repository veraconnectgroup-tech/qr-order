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

/** Hero: one operational moment. Typography + space, not dashboard chrome. */
export function LandingHeroVisual() {
  return (
    <ShowcaseStage className="mx-auto w-full max-w-none overflow-hidden bg-[#09090b] sm:min-h-[440px] lg:min-h-[520px] xl:min-h-[560px]">
      <div className="absolute right-[-16%] top-[-14%] z-10 w-[125%] origin-top-left scale-[1.24] sm:right-[-14%] sm:top-[-12%] sm:w-[120%] sm:scale-[1.2] lg:scale-[1.16]">
        <ShowcaseWindow presentation="cinematic">
          <CinematicDashboardShowcase story="live-orders" />
        </ShowcaseWindow>
      </div>

      <ShowcaseFloatDevice>
        <ShowcasePhone presentation="float" hideLabel className="max-w-none">
          <ScaledPhonePreview designWidth={300} designHeight={480}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </ShowcaseFloatDevice>
    </ShowcaseStage>
  );
}

/** Feature sections: one cropped surface each. */
export function FeatureShowcase({
  children,
  aspect = "16/10",
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
