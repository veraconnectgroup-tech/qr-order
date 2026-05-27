"use client";

import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { CinematicDashboardShowcase } from "@/components/landing/cinematic-dashboard-showcase";
import { FeatureRow } from "@/components/landing/feature-row";
import { FeatureShowcase } from "@/components/landing/landing-hero-visual";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ShowcaseAmbientStage } from "@/components/landing/showcase-composition";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";

function GuestPhoneShowcase() {
  return (
    <ShowcaseAmbientStage className="mx-auto w-full max-w-[200px] opacity-[0.88] sm:max-w-[220px]">
      <div className="translate-y-0.5 -rotate-[1deg]">
        <ShowcasePhone presentation="float" hideLabel className="max-w-none">
          <ScaledPhonePreview designWidth={280} designHeight={460}>
            <GuestMenuContent variant="cinematic" />
          </ScaledPhonePreview>
        </ShowcasePhone>
      </div>
    </ShowcaseAmbientStage>
  );
}

export function LandingFeatures() {
  return (
    <>
      <FeatureRow
        id="features-guest"
        title="Guest ordering without friction"
        lead="QR menu, table checkout, and split payments in the browser. No app. No onboarding for guests."
        visual={<GuestPhoneShowcase />}
      />

      <FeatureRow
        id="features-kitchen"
        title="Kitchen and bar in sync"
        lead="Orders route to the right station. Status flows back to the floor and to the guest automatically."
        reverse
        visual={
          <FeatureShowcase
            aspect="16/11"
            cropClassName="lg:scale-[1.36] lg:-translate-x-[18%] lg:-translate-y-[14%]"
          >
            <CinematicDashboardShowcase story="live-orders" />
          </FeatureShowcase>
        }
      />

      <FeatureRow
        id="features-staff"
        title="One floor cockpit"
        lead="Tables, calls, revenue, and live orders in a single operational view — built for service, not slides."
        visual={
          <FeatureShowcase
            aspect="16/11"
            cropClassName="lg:scale-[1.34] lg:-translate-x-[20%] lg:-translate-y-[12%]"
          >
            <CinematicDashboardShowcase story="floor" />
          </FeatureShowcase>
        }
      />

      <FeatureRow
        id="features-denis"
        title="Compliance and assistance, quietly embedded"
        lead="German fiscal requirements included. Denis helps guests order — without turning the product into a chatbot."
        reverse
        visual={
          <ShowcaseAmbientStage className="mx-auto w-full max-w-[200px] opacity-[0.88] sm:max-w-[220px]">
            <div className="translate-y-0.5 -rotate-[1deg]">
              <AiConciergeShowcase hideLabel presentation="float" />
            </div>
          </ShowcaseAmbientStage>
        }
      />
    </>
  );
}
