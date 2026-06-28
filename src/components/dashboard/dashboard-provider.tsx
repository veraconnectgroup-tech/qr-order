"use client";

import { createContext, useContext } from "react";
import type { ResolvedTheme } from "@/lib/theme/types";

export type DashboardContextValue = {
  locationId: string;
  locationName: string;
  accessibleLocations: Array<{ id: string; name: string }>;
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgLogoUrl: string | null;
  currency: string;
  staffName: string;
  staffRole: string;
  staffEmail: string | null;
  todayRevenue: number;
  stripeOnboarded: boolean;
  hasTables: boolean;
  hasMenuItems: boolean;
  onboardingCompleted: boolean;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  impersonating: boolean;
  impersonatedOrgName: string | null;
  inPersonPaymentLocation: "bar" | "counter" | "table";
  menuLocale: import("@/lib/i18n/translations").MenuLocale;
  fiscalTssEnabled: boolean;
  aiConciergeEnabled: boolean;
  venueTheme: ResolvedTheme;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: DashboardContextValue;
  children: React.ReactNode;
}) {
  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
}
