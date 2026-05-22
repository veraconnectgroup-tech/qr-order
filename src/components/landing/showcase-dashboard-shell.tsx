import {
  BarChart3,
  Bell,
  ChefHat,
  Download,
  Grid3X3,
  LayoutGrid,
  Plus,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "orders", label: "Orders", icon: LayoutGrid },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "tables", label: "Tables", icon: Grid3X3 },
  { id: "waiter-calls", label: "Waiter Calls", icon: Bell },
  { id: "history", label: "History", icon: BarChart3 },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type DashboardShowcaseScreen =
  (typeof NAV)[number]["id"];

export function ShowcaseDashboardShell({
  activeScreen,
  title,
  todayRevenue,
  currency,
  children,
  showExport,
  compact = false,
}: {
  activeScreen: DashboardShowcaseScreen;
  title: string;
  todayRevenue: number;
  currency: string;
  children: React.ReactNode;
  showExport?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex h-full bg-zinc-950 text-zinc-50">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950",
          compact ? "w-[168px]" : "w-[220px]"
        )}
      >
        <div className={cn("border-b border-zinc-800", compact ? "p-2.5" : "p-4")}>
          <p
            className={cn(
              "truncate font-bold text-zinc-50",
              compact ? "text-xs" : "text-sm"
            )}
          >
            Skyline Lounge
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span
              className={cn(
                "font-medium text-emerald-400",
                compact ? "text-[10px]" : "text-[11px]"
              )}
            >
              Open
            </span>
          </div>
        </div>

        <nav className={cn("flex-1 space-y-0.5", compact ? "p-1.5" : "p-2")}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = id === activeScreen;
            return (
              <div
                key={id}
                className={cn(
                  "flex items-center gap-2 rounded-lg font-medium",
                  compact ? "px-2 py-1.5 text-[11px]" : "gap-2.5 px-2.5 py-2 text-[13px]",
                  active
                    ? "border-l-2 border-orange-500 bg-zinc-800/50 pl-1.5 text-white"
                    : "border-l-2 border-transparent text-zinc-400"
                )}
              >
                <Icon className={cn("shrink-0", compact ? "size-3" : "size-3.5")} />
                {label}
              </div>
            );
          })}
        </nav>

        {!compact && (
          <div className="border-t border-zinc-800 p-3">
            <div className="rounded-lg bg-zinc-900 p-2.5">
              <p className="text-[10px] text-zinc-500">Staff</p>
              <p className="mt-0.5 truncate text-xs font-medium text-zinc-300">
                Nica
              </p>
              <p className="text-[10px] capitalize text-zinc-600">owner</p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/90",
            compact ? "h-11 px-3" : "h-14 px-5"
          )}
        >
          <h1
            className={cn(
              "font-bold text-zinc-50",
              compact ? "text-sm" : "text-lg"
            )}
          >
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <div className={cn("rounded-lg bg-zinc-900", compact ? "px-2 py-0.5" : "px-2.5 py-1")}>
              <span className="text-[10px] text-zinc-500">Today </span>
              <span className="font-mono text-xs font-bold text-orange-500">
                {formatPrice(todayRevenue, currency)}
              </span>
            </div>
            {showExport && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300">
                <Download className="size-3" />
                Export CSV
              </div>
            )}
          </div>
        </header>

        <main className={cn("flex-1 overflow-hidden", compact ? "p-3" : "p-5")}>
          {children}
        </main>
      </div>
    </div>
  );
}
