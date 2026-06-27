"use client";

import { usePathname } from "next/navigation";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-mobile-nav";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import type { DashboardContextValue } from "@/components/dashboard/dashboard-provider";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { DashboardResilienceShell } from "@/components/dashboard/dashboard-resilience-shell";
import { PwaInstallBanner } from "@/components/dashboard/pwa-install-banner";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DashboardAlertsProvider } from "@/hooks/use-dashboard-alerts";
import { StaffNotificationsProvider } from "@/hooks/use-staff-notifications";
import { SoundAlertProvider } from "@/hooks/use-sound-alert";

function DashboardBanners() {
  const { impersonating, impersonatedOrgName } = useDashboard();

  return (
    <>
      {impersonating && impersonatedOrgName && (
        <ImpersonationBanner orgName={impersonatedOrgName} />
      )}
      <PwaInstallBanner />
      <TrialBanner />
    </>
  );
}

function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <SoundAlertProvider>
      <DashboardAlertsProvider>
        <StaffNotificationsProvider>
          <div className="dashboard-theme flex min-h-dvh overflow-x-hidden bg-background text-foreground">
            <DashboardSidebar />
            <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
              <DashboardBanners />
              <DashboardTopBar />
              <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
                {children}
              </main>
            </div>
            <DashboardMobileNav />
          </div>
        </StaffNotificationsProvider>
      </DashboardAlertsProvider>
    </SoundAlertProvider>
  );
}

export function DashboardShell({
  context,
  children,
}: {
  context: DashboardContextValue;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isKitchen = pathname.startsWith("/dashboard/kitchen");
  const isSetup = pathname.startsWith("/dashboard/setup");

  return (
    <DashboardProvider value={context}>
      <DashboardResilienceShell staffRole={context.staffRole}>
        {isSetup ? (
          <div className="dashboard-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
            {children}
          </div>
        ) : isKitchen ? (
          <SoundAlertProvider>
            <DashboardAlertsProvider>
              <div className="dashboard-theme min-h-screen overflow-x-hidden bg-background text-foreground md:min-h-dvh">
                <DashboardBanners />
                {children}
              </div>
            </DashboardAlertsProvider>
          </SoundAlertProvider>
        ) : (
          <DashboardFrame>{children}</DashboardFrame>
        )}
      </DashboardResilienceShell>
    </DashboardProvider>
  );
}
