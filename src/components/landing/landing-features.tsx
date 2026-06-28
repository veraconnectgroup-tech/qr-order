"use client";

import { FeatureRow } from "@/components/landing/feature-row";
import { GuestMenuShowcase } from "@/components/landing/guest-menu-showcase";
import { KitchenShowcase } from "@/components/landing/kitchen-showcase";
import { OrdersShowcase } from "@/components/landing/orders-showcase";
import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";

export function LandingFeatures() {
  const { copy } = useLandingCopy();
  const [guest, kitchen, staff, denis] = copy.features;

  return (
    <>
      <FeatureRow
        id={guest.id}
        eyebrow={guest.eyebrow}
        title={guest.title}
        lead={guest.lead}
        bullets={guest.bullets}
        visual={<GuestMenuShowcase hideLabel />}
      />

      <FeatureRow
        id={kitchen.id}
        eyebrow={kitchen.eyebrow}
        title={kitchen.title}
        lead={kitchen.lead}
        bullets={kitchen.bullets}
        reverse={kitchen.reverse}
        visual={
          <div className="space-y-6">
            <KitchenShowcase />
            <OrdersShowcase compact />
          </div>
        }
      />

      <FeatureRow
        id={staff.id}
        eyebrow={staff.eyebrow}
        title={staff.title}
        lead={staff.lead}
        bullets={staff.bullets}
        visual={
          <ShowcaseWindow url="denis.app/dashboard/tables" theme="dark">
            <DashboardScreenShowcase
              screen="tables"
              variant="feature"
              theme="dark"
            />
          </ShowcaseWindow>
        }
      />

      <FeatureRow
        id={denis.id}
        eyebrow={denis.eyebrow}
        title={denis.title}
        lead={denis.lead}
        bullets={denis.bullets}
        reverse={denis.reverse}
        visual={<AiConciergeShowcase hideLabel />}
      />
    </>
  );
}
