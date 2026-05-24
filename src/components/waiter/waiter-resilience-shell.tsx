"use client";

import { useEffect } from "react";
import { ConnectionBanner } from "@/components/dashboard/connection-banner";
import { DashboardErrorBoundary } from "@/components/error/dashboard-error-boundary";
import { initOfflineSyncManager } from "@/lib/offline/sync-manager";

type Props = {
  children: React.ReactNode;
  staffRole?: string;
};

export function WaiterResilienceShell({ children, staffRole }: Props) {
  useEffect(() => initOfflineSyncManager(), []);

  return (
    <DashboardErrorBoundary userRole={staffRole}>
      <ConnectionBanner />
      {children}
    </DashboardErrorBoundary>
  );
}
