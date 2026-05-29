"use client";

import { useConnectionStatus } from "@/hooks/use-connection-status";
import { cn } from "@/lib/utils";
import {
  DashboardProvider,
  type DashboardContextValue,
} from "@/components/dashboard/dashboard-provider";
import { DashboardAlertsProvider } from "@/hooks/use-dashboard-alerts";
import { SoundAlertProvider } from "@/hooks/use-sound-alert";

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

function BarStatusBar({
  locationName,
  staffName,
}: {
  locationName: string;
  staffName: string;
}) {
  const { status } = useConnectionStatus();

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center border-b border-dash-border-subtle bg-dash-bg/95 px-4 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-dash-text">Bar</p>
        <p className="truncate text-[11px] text-dash-text-muted">{locationName}</p>
      </div>
      <div className="flex items-center gap-1.5 px-2">
        <ConnectionDot status={status} />
        <span className="text-[10px] capitalize text-dash-text-muted">
          {status}
        </span>
      </div>
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dash-surface-raised text-xs font-bold text-dash-text-secondary"
        aria-label={staffName}
      >
        {staffName.charAt(0).toUpperCase()}
      </div>
    </header>
  );
}

export function BarShell({ context, children }: Props) {
  return (
    <DashboardProvider value={context}>
      <SoundAlertProvider>
        <DashboardAlertsProvider variant="waiter">
          <div className="dashboard-theme flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
            <BarStatusBar
              locationName={context.locationName}
              staffName={context.staffName}
            />
            <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {children}
            </main>
          </div>
        </DashboardAlertsProvider>
      </SoundAlertProvider>
    </DashboardProvider>
  );
}
