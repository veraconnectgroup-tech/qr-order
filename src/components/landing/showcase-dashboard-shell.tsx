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
import type { ShowcaseTheme } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "orders", label: "Orders", icon: LayoutGrid },
  { id: "kitchen", label: "Prep Display", icon: ChefHat },
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
  cinematic = false,
  theme = "dark",
}: {
  activeScreen: DashboardShowcaseScreen;
  title: string;
  todayRevenue: number;
  currency: string;
  children: React.ReactNode;
  showExport?: boolean;
  compact?: boolean;
  cinematic?: boolean;
  theme?: ShowcaseTheme;
}) {
  const light = theme === "light";

  if (cinematic) {
    return (
      <div className="h-full bg-[#09090b] text-zinc-50">
        <main className="h-full overflow-hidden px-14 py-16 sm:px-16 sm:py-20">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full",
        light ? "bg-white text-zinc-900" : "bg-zinc-950 text-zinc-50"
      )}
    >
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r",
          compact ? "w-[168px]" : "w-[220px]",
          light ? "border-zinc-200 bg-zinc-50" : "border-zinc-800 bg-zinc-950"
        )}
      >
        <div className={cn("border-b", compact ? "p-2.5" : "p-4", light ? "border-zinc-200" : "border-zinc-800")}>
          <p
            className={cn(
              "truncate font-bold",
              compact ? "text-xs" : "text-sm",
              light ? "text-zinc-900" : "text-zinc-50"
            )}
          >
            Skyline Lounge
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span
              className={cn(
                "font-medium text-emerald-600",
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
                    ? light
                      ? "border-l-2 border-orange-500 bg-orange-50 pl-1.5 text-orange-900"
                      : "border-l-2 border-orange-500 bg-zinc-800/50 pl-1.5 text-white"
                    : light
                      ? "border-l-2 border-transparent text-zinc-500"
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
          <div className={cn("border-t p-3", light ? "border-zinc-200" : "border-zinc-800")}>
            <div className={cn("rounded-lg p-2.5", light ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-900")}>
              <p className={cn("text-[10px]", light ? "text-zinc-500" : "text-zinc-500")}>Staff</p>
              <p className={cn("mt-0.5 truncate text-xs font-medium", light ? "text-zinc-800" : "text-zinc-300")}>
                Nica
              </p>
              <p className={cn("text-[10px] capitalize", light ? "text-zinc-400" : "text-zinc-600")}>owner</p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between border-b",
            compact ? "h-11 px-3" : "h-14 px-5",
            light ? "border-zinc-200 bg-white" : "border-zinc-800 bg-zinc-950/90"
          )}
        >
          <h1
            className={cn(
              "font-bold",
              compact ? "text-sm" : "text-lg",
              light ? "text-zinc-900" : "text-zinc-50"
            )}
          >
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "rounded-lg",
                compact ? "px-2 py-0.5" : "px-2.5 py-1",
                light ? "bg-orange-50 ring-1 ring-orange-100" : "bg-zinc-900"
              )}
            >
              <span className={cn("text-[10px]", light ? "text-zinc-500" : "text-zinc-500")}>Today </span>
              <span className="font-mono text-xs font-bold text-orange-500">
                {formatPrice(todayRevenue, currency)}
              </span>
            </div>
            {showExport && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px]",
                  light ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"
                )}
              >
                <Download className="size-3" />
                Export CSV
              </div>
            )}
          </div>
        </header>

        <main
          className={cn(
            "flex-1 overflow-hidden",
            compact ? "p-3" : "p-5",
            light ? "bg-zinc-50/50" : ""
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
