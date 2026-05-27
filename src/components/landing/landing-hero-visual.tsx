"use client";

import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import {
  ShowcasePhone,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";

export function LandingHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
      <div className="relative lg:hidden">
        <ShowcaseWindow url="denis.app/dashboard" theme="dark">
          <DashboardScreenShowcase screen="orders" variant="hero" theme="dark" />
        </ShowcaseWindow>
        <div className="absolute -bottom-8 -left-2 z-10 w-[34%] min-w-[112px] max-w-[148px]">
          <ShowcasePhone hideLabel className="max-w-none">
            <ScaledPhonePreview designHeight={480}>
              <GuestMenuContent variant="hero" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <ShowcaseWindow url="denis.app/dashboard/orders" theme="dark">
          <DashboardScreenShowcase screen="orders" variant="hero" theme="dark" />
        </ShowcaseWindow>
        <div className="absolute bottom-0 left-0 z-10 w-[32%] min-w-[160px] max-w-[200px] -translate-x-[8%] translate-y-[8%]">
          <ShowcasePhone hideLabel className="max-w-none">
            <ScaledPhonePreview designHeight={520}>
              <GuestMenuContent variant="hero" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </div>
      </div>
    </div>
  );
}
