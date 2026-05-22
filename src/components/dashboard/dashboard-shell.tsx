"use client";

import { usePathname } from "next/navigation";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-mobile-nav";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import type { DashboardContextValue } from "@/components/dashboard/dashboard-provider";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";

export function DashboardShell({
  context,
  children,
}: {
  context: DashboardContextValue;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isKitchen = pathname.startsWith("/dashboard/kitchen");

  if (isKitchen) {
    return (
      <DashboardProvider value={context}>
        <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50">
          {children}
        </div>
      </DashboardProvider>
    );
  }

  return (
    <DashboardProvider value={context}>
      <div className="flex min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50">
        <DashboardSidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <DashboardTopBar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-6">
            {children}
          </main>
        </div>
        <DashboardMobileNav />
      </div>
    </DashboardProvider>
  );
}
