"use client";

import { CinematicDashboardShowcase } from "@/components/landing/cinematic-dashboard-showcase";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import {
  ShowcaseAmbientStage,
  ShowcaseCropFrame,
} from "@/components/landing/showcase-composition";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import {
  ShowcasePhone,
  ShowcaseStage,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";

/** Hero: bounded stage, one dominant surface + one floating phone. */
export function LandingHeroVisual() {
  return (
    <ShowcaseStage className="mx-auto w-full max-w-none overflow-hidden rounded-2xl sm:min-h-[400px] lg:min-h-[460px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_70%_55%_at_68%_38%,rgba(255,255,255,0.045),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/[0.06]"
      />

      <div className="absolute right-[-3%] top-[-1%] z-10 w-[94%] sm:w-[91%] lg:right-[-2%] lg:w-[88%]">
        <ShowcaseWindow url="denis.app/dashboard/orders" presentation="cinematic">
          <CinematicDashboardShowcase story="live-orders" />
        </ShowcaseWindow>
      </div>

      <div className="pointer-events-none absolute bottom-[4%] left-[-1%] z-20 hidden w-[34%] min-w-[136px] max-w-[176px] md:block">
        <div className="-rotate-2 drop-shadow-[0_24px_56px_rgba(0,0,0,0.62)]">
          <ShowcasePhone presentation="float" hideLabel className="max-w-none">
            <ScaledPhonePreview designWidth={300} designHeight={520}>
              <GuestMenuContent variant="cinematic" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </div>
      </div>
    </ShowcaseStage>
  );
}

/** Feature sections: single cropped surface, no device collage. */
export function FeatureShowcase({
  url,
  children,
  aspect = "16/10",
  className,
}: {
  url: string;
  children: React.ReactNode;
  aspect?: string;
  className?: string;
}) {
  return (
    <ShowcaseAmbientStage className={className}>
      <ShowcaseCropFrame aspect={aspect}>
        <ShowcaseWindow url={url} presentation="cinematic">
          {children}
        </ShowcaseWindow>
      </ShowcaseCropFrame>
    </ShowcaseAmbientStage>
  );
}
