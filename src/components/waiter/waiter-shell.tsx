"use client";

import { useConnectionStatus } from "@/hooks/use-connection-status";
import { cn } from "@/lib/utils";
import { WaiterResilienceShell } from "@/components/waiter/waiter-resilience-shell";
import {
  DashboardProvider,
  type DashboardContextValue,
} from "@/components/dashboard/dashboard-provider";
import { DashboardAlertsProvider } from "@/hooks/use-dashboard-alerts";
import { StaffNotificationsProvider } from "@/hooks/use-staff-notifications";
import { SoundAlertProvider } from "@/hooks/use-sound-alert";
import { WaiterBottomNav } from "@/components/waiter/waiter-bottom-nav";
import { PushOptIn } from "@/components/dashboard/push-opt-in";
import { StaffNotificationsBell } from "@/components/dashboard/staff-notifications-bell";
import {
  WaiterDataPrefetch,
  WaiterUxEffects,
} from "@/components/waiter/waiter-ux-effects";

type Props = {
  context: DashboardContextValue;
  children: React.ReactNode;
};

function ConnectionDot({
  status,
}: {
  status: ReturnType<typeof useConnectionStatus>["status"];
}) {
  const color =
    status === "online"
      ? "bg-emerald-500"
      : status === "degraded"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <span className="relative flex size-2.5">
      {status !== "online" && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            color
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", color)} />
    </span>
  );
}

function WaiterStatusBar({
  orgName,
  staffName,
  showDenisAlerts,
}: {
  orgName: string;
  staffName: string;
  showDenisAlerts?: boolean;
}) {
  const { status } = useConnectionStatus();

  return (
    <header className="sticky top-0 z-40 flex h-10 shrink-0 items-center border-b border-dash-border-subtle bg-dash-bg/95 px-4 backdrop-blur-xl">
      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-dash-text">
        {orgName}
      </p>
      <div className="flex items-center gap-1.5 px-2">
        {showDenisAlerts ? <StaffNotificationsBell compact /> : null}
        <ConnectionDot status={status} />
        <span className="text-[10px] capitalize text-dash-text-muted">
          {status}
        </span>
      </div>
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-dash-surface-raised text-[11px] font-bold text-dash-text-secondary"
        aria-label={staffName}
      >
        {staffName.charAt(0).toUpperCase()}
      </div>
    </header>
  );
}

function WaiterFrame({
  context,
  children,
}: {
  context: DashboardContextValue;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-theme flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
      <PushOptIn variant="banner" />
      <WaiterStatusBar
        orgName={context.orgName}
        staffName={context.staffName}
        showDenisAlerts={context.aiConciergeEnabled}
      />
      <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <WaiterDataPrefetch />
        <WaiterUxEffects />
        {children}
      </main>
      <WaiterBottomNav />
    </div>
  );
}

export function WaiterShell({ context, children }: Props) {
  const frame = <WaiterFrame context={context}>{children}</WaiterFrame>;

  return (
    <DashboardProvider value={context}>
      <WaiterResilienceShell staffRole={context.staffRole}>
        <SoundAlertProvider>
          <DashboardAlertsProvider variant="waiter">
            {context.aiConciergeEnabled ? (
              <StaffNotificationsProvider>{frame}</StaffNotificationsProvider>
            ) : (
              frame
            )}
          </DashboardAlertsProvider>
        </SoundAlertProvider>
      </WaiterResilienceShell>
    </DashboardProvider>
  );
}
