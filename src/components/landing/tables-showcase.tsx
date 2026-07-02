import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { Tablet } from "lucide-react";

function TabletCaption({ label }: { label: string }) {
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 sm:text-xs">
      <Tablet className="size-3" aria-hidden />
      {label}
    </p>
  );
}

export function TablesShowcase() {
  return (
    <div className="w-full min-w-0">
      <DashboardScreenShowcase screen="tables" theme="light" />
      <TabletCaption label="Staff tablet - Tables & QR codes" />
    </div>
  );
}

export function HistoryShowcase() {
  return (
    <div className="w-full min-w-0">
      <DashboardScreenShowcase screen="history" theme="light" />
      <TabletCaption label="Staff tablet - History & analytics" />
    </div>
  );
}
