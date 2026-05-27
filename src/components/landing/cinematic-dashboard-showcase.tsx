"use client";

import { OrdersBoardContent } from "@/components/landing/showcase-content";
import { TablesShowcaseContent } from "@/components/landing/dashboard-screen-showcase";
import { ScaledDashboardPreview } from "@/components/landing/scaled-dashboard-preview";
import {
  ShowcaseDashboardShell,
  type DashboardShowcaseScreen,
} from "@/components/landing/showcase-dashboard-shell";
import { DEMO_CURRENCY, DEMO_TODAY_REVENUE } from "@/components/landing/demo-data";

export type CinematicStory = "live-orders" | "floor";

const STORY_SCREEN: Record<CinematicStory, DashboardShowcaseScreen> = {
  "live-orders": "orders",
  floor: "tables",
};

/** Large-scale cropped dashboard for landing cinematography only. */
export function CinematicDashboardShowcase({
  story = "live-orders",
}: {
  story?: CinematicStory;
}) {
  const screen = STORY_SCREEN[story];

  return (
    <ScaledDashboardPreview designHeight={360}>
      <ShowcaseDashboardShell
        activeScreen={screen}
        title={screen === "tables" ? "Tables" : "Live Orders"}
        todayRevenue={DEMO_TODAY_REVENUE}
        currency={DEMO_CURRENCY}
        compact
        cinematic
      >
        {screen === "orders" && (
          <OrdersBoardContent variant="cinematic" theme="dark" />
        )}
        {screen === "tables" && (
          <TablesShowcaseContent compact cinematic theme="dark" />
        )}
      </ShowcaseDashboardShell>
    </ScaledDashboardPreview>
  );
}
