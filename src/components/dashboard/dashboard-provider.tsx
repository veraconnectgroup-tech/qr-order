"use client";

import { createContext, useContext } from "react";

export type DashboardContextValue = {
  locationId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  currency: string;
  staffName: string;
  staffRole: string;
  staffEmail: string | null;
  todayRevenue: number;
  stripeOnboarded: boolean;
  hasTables: boolean;
  hasMenuItems: boolean;
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
