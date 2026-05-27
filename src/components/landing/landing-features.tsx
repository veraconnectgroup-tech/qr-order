"use client";

import { FeatureRow } from "@/components/landing/feature-row";
import { GuestMenuShowcase } from "@/components/landing/guest-menu-showcase";
import { OrdersShowcase } from "@/components/landing/orders-showcase";
import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";

export function LandingFeatures() {
  return (
    <>
      <FeatureRow
        id="features-guest"
        title="Guest ordering without friction"
        lead="QR menu, table checkout, and split payments in the browser. No app. No onboarding for guests."
        visual={<GuestMenuShowcase hideLabel />}
      />

      <FeatureRow
        id="features-kitchen"
        title="Kitchen and bar in sync"
        lead="Orders route to the right station. Status flows back to the floor and to the guest automatically."
        reverse
        visual={<OrdersShowcase compact />}
      />

      <FeatureRow
        id="features-staff"
        title="One floor cockpit"
        lead="Tables, calls, revenue, and live orders in a single operational view — built for service, not slides."
        visual={
          <ShowcaseWindow url="denis.app/dashboard/tables" theme="dark">
            <DashboardScreenShowcase screen="tables" variant="feature" theme="dark" />
          </ShowcaseWindow>
        }
      />

      <FeatureRow
        id="features-denis"
        title="Compliance and assistance, quietly embedded"
        lead="German fiscal requirements included. Denis helps guests order — without turning the product into a chatbot."
        reverse
        visual={<AiConciergeShowcase hideLabel />}
      />
    </>
  );
}
