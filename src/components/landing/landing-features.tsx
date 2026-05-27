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
    <ShowcaseAmbientStage className="mx-auto w-full max-w-[240px] sm:max-w-[260px]">
      <ShowcasePhone presentation="float" hideLabel className="max-w-none">
        <ScaledPhonePreview designWidth={300} designHeight={520}>
          <GuestMenuContent variant="cinematic" />
        </ScaledPhonePreview>
      </ShowcasePhone>
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
            url="denis.app/dashboard/orders"
            aspect="16/10"
            cropClassName="lg:scale-[1.16] lg:-translate-x-[9%]"
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
            url="denis.app/dashboard/tables"
            aspect="16/10"
            cropClassName="lg:scale-[1.14] lg:-translate-x-[8%] lg:-translate-y-[6%]"
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
          <ShowcaseAmbientStage className="mx-auto w-full max-w-[240px] sm:max-w-[260px]">
            <AiConciergeShowcase hideLabel presentation="float" />
          </ShowcaseAmbientStage>
        }
      />
    </>
  );
}
