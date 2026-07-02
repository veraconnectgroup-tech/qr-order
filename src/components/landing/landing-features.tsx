"use client";

import { FeatureRow } from "@/components/landing/feature-row";
import { GuestMenuShowcase } from "@/components/landing/guest-menu-showcase";
import { KitchenShowcase } from "@/components/landing/kitchen-showcase";
import { OrdersShowcase } from "@/components/landing/orders-showcase";
import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingVisualStage } from "@/components/landing/landing-visual-stage";

export function LandingFeatures() {
  const { copy } = useLandingCopy();
  const [guest, kitchen, staff, denis] = copy.features;

  return (
    <>
      <FeatureRow
        id={guest.id}
        index={1}
        eyebrow={guest.eyebrow}
        title={guest.title}
        lead={guest.lead}
        bullets={guest.bullets}
        visual={
          <LandingVisualStage variant="phone">
            <GuestMenuShowcase hideLabel />
          </LandingVisualStage>
        }
      />

      <FeatureRow
        id={kitchen.id}
        index={2}
        eyebrow={kitchen.eyebrow}
        title={kitchen.title}
        lead={kitchen.lead}
        bullets={kitchen.bullets}
        reverse={kitchen.reverse}
        tone="tint"
        visual={
          <LandingVisualStage variant="panel" className="space-y-5">
            <KitchenShowcase />
            <OrdersShowcase compact />
          </LandingVisualStage>
        }
      />

      <FeatureRow
        id={staff.id}
        index={3}
        eyebrow={staff.eyebrow}
        title={staff.title}
        lead={staff.lead}
        bullets={staff.bullets}
        visual={
          <LandingVisualStage variant="flush">
            <ShowcaseWindow
              url="denis.app/dashboard/tables"
              theme="light"
              className="shadow-[0_24px_64px_-24px_rgba(22,20,14,0.14)]"
            >
              <DashboardScreenShowcase
                screen="tables"
                variant="feature"
                theme="light"
              />
            </ShowcaseWindow>
          </LandingVisualStage>
        }
      />

      <FeatureRow
        id={denis.id}
        index={4}
        eyebrow={denis.eyebrow}
        title={denis.title}
        lead={denis.lead}
        bullets={denis.bullets}
        reverse={denis.reverse}
        tone="tint"
        visual={
          <LandingVisualStage variant="phone">
            <AiConciergeShowcase hideLabel />
          </LandingVisualStage>
        }
      />
    </>
  );
}
