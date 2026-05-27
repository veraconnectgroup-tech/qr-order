"use client";

import { FeatureRow } from "@/components/landing/feature-row";
import { GuestMenuShowcase } from "@/components/landing/guest-menu-showcase";
import { KitchenShowcase } from "@/components/landing/kitchen-showcase";
import { OrdersShowcase } from "@/components/landing/orders-showcase";
import { AiConciergeShowcase } from "@/components/landing/ai-concierge-showcase";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";

export function LandingFeatures() {
  return (
    <>
      <FeatureRow
        id="features-guest"
        eyebrow="Guest ordering"
        title="Scan, browse, pay — no app download"
        lead="Guests order from their phone in seconds. Card payments, split bills, and table context built in."
        bullets={[
          "QR menu with live availability and modifiers",
          "Stripe Connect checkout at the table",
          "Split bill and order tracking in one flow",
        ]}
        visual={
          <GuestMenuShowcase hideLabel />
        }
      />

      <FeatureRow
        id="features-kitchen"
        eyebrow="Kitchen & bar sync"
        title="Every order hits the right station instantly"
        lead="Kitchen display, bar routing, and live order boards stay in sync — no paper tickets, no missed fires."
        bullets={[
          "Prep display with high-contrast ticket cards",
          "Live order board for floor and bar staff",
          "Status updates flow back to guests automatically",
        ]}
        reverse
        visual={
          <div className="space-y-6">
            <KitchenShowcase />
            <OrdersShowcase compact />
          </div>
        }
      />

      <FeatureRow
        id="features-staff"
        eyebrow="Staff coordination"
        title="Run the floor from one operational cockpit"
        lead="Tables, waiter calls, revenue, and quick actions — designed for service speed, not dashboard clutter."
        bullets={[
          "Zone-based table board with live session totals",
          "Waiter calls and order history in one shell",
          "Revenue and floor snapshot above the fold",
        ]}
        visual={
          <ShowcaseWindow url="denis.app/dashboard/tables" theme="dark">
            <DashboardScreenShowcase screen="tables" variant="feature" theme="dark" />
          </ShowcaseWindow>
        }
      />

      <FeatureRow
        id="features-denis"
        eyebrow="Intelligence & compliance"
        title="Embedded intelligence, not a chatbot gimmick"
        lead="Denis assists guests and staff quietly — recommendations, ordering, and German fiscal compliance in one system."
        bullets={[
          "Structured concierge panel — not iMessage bubbles",
          "KassenSichV, TSE, DATEV export included",
          "Allergen-aware recommendations at the table",
        ]}
        reverse
        visual={
          <AiConciergeShowcase hideLabel />
        }
      />
    </>
  );
}
