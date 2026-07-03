"use client";

import { Plus } from "lucide-react";
import {
  DEMO_CURRENCY,
  DEMO_TABLES,
  DEMO_TODAY_REVENUE,
  DEMO_ZONES,
  type DemoTable,
} from "@/components/landing/demo-data";
import { OrdersBoardContent } from "@/components/landing/showcase-content";
import {
  ScaledDashboardPreview,
} from "@/components/landing/scaled-dashboard-preview";
import {
  ShowcaseDashboardShell,
  type DashboardShowcaseScreen,
} from "@/components/landing/showcase-dashboard-shell";
import type { ShowcaseTheme } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const CINEMATIC_FLOOR_TABLES = ["t7", "t9", "t4"] as const;

function TableCard({
  table,
  compact = false,
  cinematic = false,
  theme = "dark",
}: {
  table: DemoTable;
  compact?: boolean;
  cinematic?: boolean;
  theme?: ShowcaseTheme;
}) {
  const light = theme === "light";

  if (cinematic) {
    return (
      <div
        className={cn(
          "min-w-[92px] rounded-lg border px-3 py-3 text-center",
          table.status === "attention" &&
            "border-red-500/50 bg-red-500/[0.06]",
          table.status === "occupied" &&
            (light ? "border-emerald-200 bg-emerald-50/70" : "border-green-500/35 bg-zinc-950/90"),
          table.status === "available" &&
            (light ? "border-[#e3e7ee] bg-white" : "border-zinc-800 bg-zinc-950/70")
        )}
      >
        <p
          className={cn(
            "font-mono text-sm font-semibold",
            light ? "text-[#1f2328]" : "text-zinc-100"
          )}
        >
          {table.name}
        </p>
        {table.status === "attention" ? (
          <p className="mt-2 text-[10px] font-medium text-red-400">
            <span className="mr-1 inline-block size-1 rounded-full bg-red-500" />
            Call
          </p>
        ) : table.status === "occupied" ? (
          <>
            <p className="mt-2 text-[10px] text-green-400">
              <span className="mr-1 inline-block size-1 rounded-full bg-green-500" />
              Active
            </p>
            {table.sessionTotal != null && (
              <p
                className={cn(
                  "mt-1 font-mono text-[11px] tabular-nums",
                  light ? "text-[#596273]" : "text-zinc-400"
                )}
              >
                {formatPrice(table.sessionTotal, DEMO_CURRENCY)}
              </p>
            )}
          </>
        ) : (
          <p className={cn("mt-2 text-[10px]", light ? "text-[#6b7280]" : "text-zinc-500")}>
            Open
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border text-center",
        compact ? "p-2" : "p-4",
        light ? "bg-white" : "bg-zinc-900",
        table.status === "attention" && "border-red-300 bg-red-50",
        table.status === "occupied" && (light ? "border-emerald-200 bg-emerald-50/40" : "border-green-500/50"),
        table.status === "available" && (light ? "border-[#e3e7ee]" : "border-zinc-800")
      )}
    >
      <p
        className={cn(
          "font-mono font-bold",
          compact ? "text-xs" : "text-lg",
          light ? "text-[#1f2328]" : "text-zinc-50"
        )}
      >
        {table.name}
      </p>
      <p className={cn(light ? "text-[#6b7280]" : "text-zinc-500", compact ? "text-[9px]" : "text-xs")}>
        {table.seats} seats
      </p>
      {table.status === "attention" ? (
        <p className={cn("text-red-500", compact ? "mt-1 text-[8px]" : "mt-1.5 text-xs")}>
          <span className="mr-0.5 inline-block size-1 rounded-full bg-red-500" />
          Attention
        </p>
      ) : table.status === "occupied" ? (
        <>
          <p className={cn("text-emerald-600", compact ? "mt-1 text-[8px]" : "mt-1.5 text-xs")}>
            <span className="mr-0.5 inline-block size-1 rounded-full bg-green-500" />
            Occupied
          </p>
          {table.sessionTotal != null && (
            <p
              className={cn(
                "font-mono text-[#1f2328]",
                compact ? "text-[9px]" : "text-sm"
              )}
            >
              {formatPrice(table.sessionTotal, DEMO_CURRENCY)}
            </p>
          )}
        </>
      ) : (
        <p className={cn(light ? "text-[#6b7280]" : "text-zinc-500", compact ? "mt-1 text-[8px]" : "mt-1.5 text-xs")}>
          <span className="mr-0.5 inline-block size-1 rounded-full bg-green-500" />
          Available
        </p>
      )}
    </div>
  );
}

export function TablesShowcaseContent({
  compact = false,
  cinematic = false,
  theme = "dark",
}: {
  compact?: boolean;
  cinematic?: boolean;
  theme?: ShowcaseTheme;
}) {
  const light = theme === "light";
  const tables = cinematic
    ? CINEMATIC_FLOOR_TABLES.map(
        (id) => DEMO_TABLES.find((table) => table.id === id)!
      )
    : DEMO_TABLES;

  return (
    <>
      {cinematic && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p
              className={cn(
                "text-[10px] font-medium uppercase tracking-normal",
                light ? "text-[#6b7280]" : "text-zinc-600"
              )}
            >
              Floor
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tracking-normal",
                light ? "text-[#1f2328]" : "text-zinc-100"
              )}
            >
              Tables
            </p>
          </div>
          <p className={cn("text-[11px]", light ? "text-[#6b7280]" : "text-zinc-500")}>
            Rooftop <span className="font-medium text-emerald-500">● Live</span>
          </p>
        </div>
      )}
      {!cinematic && (
        <div
          className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-3",
            compact && "mb-2 gap-2"
          )}
        >
          <div
            className={cn(
              "flex flex-wrap gap-4 border-b pb-1.5",
              compact && "gap-2",
              light ? "border-[#e7ebf0]" : "border-zinc-800"
            )}
          >
            <span
              className={cn(
                "border-b-2 border-[#e85d04] pb-1.5 font-medium",
                compact ? "text-[10px]" : "text-xs",
                light ? "text-[#1f2328]" : "text-white"
              )}
            >
              All ({DEMO_TABLES.length})
            </span>
            {DEMO_ZONES.map((zone) => (
              <span
                key={zone.id}
                className={cn(
                  "pb-1.5 font-medium",
                  light ? "text-[#6b7280]" : "text-zinc-400",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {zone.name} ({zone.count})
              </span>
            ))}
          </div>
          {!compact && (
            <div className="flex gap-2">
              <span className={cn("rounded-md px-3 py-1.5 text-[11px]", light ? "bg-[#eef1f5] text-[#596273]" : "bg-zinc-800 text-zinc-300")}>
                Download All QR Codes
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#1f2328] px-3 py-1.5 text-[11px] font-semibold text-white">
                <Plus className="size-3" />
                Add Table
              </span>
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          cinematic ? "flex gap-3" : "grid grid-cols-6 gap-2.5",
          compact && !cinematic && "grid-cols-6 gap-1.5"
        )}
      >
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            compact={compact || cinematic}
            cinematic={cinematic}
            theme={theme}
          />
        ))}
      </div>
    </>
  );
}

function HistoryShowcaseContent({ theme = "dark" }: { theme?: ShowcaseTheme }) {
  const light = theme === "light";
  const stats = [
    { label: "Revenue", value: formatPrice(DEMO_TODAY_REVENUE, DEMO_CURRENCY), delta: "+100% ↑" },
    { label: "Orders", value: "4", delta: "+100% ↑" },
    { label: "Avg Order", value: formatPrice(17.26, DEMO_CURRENCY), delta: "+14.26 € ↑" },
    { label: "Top Item", value: "Whiskey Sour", delta: "(2)" },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-xl border p-4",
              light ? "border-zinc-200 bg-white" : "border-zinc-800 bg-zinc-900"
            )}
          >
            <p className={cn("text-[11px]", light ? "text-zinc-500" : "text-zinc-400")}>{s.label}</p>
            <p className={cn("mt-0.5 font-mono text-xl font-bold", light ? "text-zinc-900" : "text-white")}>
              {s.value}
            </p>
            <p className="mt-1 text-[11px] text-green-400">{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {["Today", "Yesterday", "This Week", "This Month", "Custom"].map(
          (f, i) => (
            <span
              key={f}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px]",
                i === 0
                  ? "bg-orange-500 text-white"
                  : light
                    ? "bg-zinc-100 text-zinc-600"
                    : "bg-zinc-800 text-zinc-400"
              )}
            >
              {f}
            </span>
          )
        )}
      </div>

      <div className={cn("overflow-hidden rounded-xl border", light ? "border-zinc-200 bg-white" : "border-zinc-800 bg-zinc-900/50")}>
        <table className="w-full text-[11px]">
          <thead>
            <tr className={cn("text-left text-[10px] font-semibold uppercase tracking-normal", light ? "bg-zinc-50 text-zinc-500" : "bg-zinc-800/50 text-zinc-400")}>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Table</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {[
              { num: 4, table: "Table 3", items: 6, total: 38.08, status: "New", statusCls: "bg-orange-500/10 text-orange-400", pay: "Pending", payCls: "text-yellow-400", time: "20:30" },
              { num: 3, table: "Table 8", items: 7, total: 44.63, status: "New", statusCls: "bg-orange-500/10 text-orange-400", pay: "Pending", payCls: "text-yellow-400", time: "20:21" },
              { num: 2, table: "Terrace 5", items: 4, total: 25.5, status: "Delivered", statusCls: "bg-green-500/10 text-green-400", pay: "Pay at counter", payCls: "text-zinc-400", time: "20:20" },
              { num: 1, table: "Table 8", items: 1, total: 9.5, status: "Delivered", statusCls: "bg-green-500/10 text-green-400", pay: "Pay at counter", payCls: "text-zinc-400", time: "20:20" },
            ].map((row) => (
              <tr
                key={row.num}
                className={cn("border-b", light ? "border-zinc-100 text-zinc-700" : "border-zinc-800/50 text-zinc-300")}
              >
                <td className={cn("px-3 py-2 font-mono font-semibold", light ? "text-zinc-900" : "text-zinc-50")}>
                  #{String(row.num).padStart(3, "0")}
                </td>
                <td className="px-3 py-2">{row.table}</td>
                <td className="px-3 py-2">{row.items}</td>
                <td className="px-3 py-2 font-mono">
                  {formatPrice(row.total, DEMO_CURRENCY)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      row.statusCls
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className={cn("px-3 py-2", row.payCls)}>{row.pay}</td>
                <td className="px-3 py-2 text-zinc-500">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-3 py-2 text-[10px] text-zinc-500">
          <span>Showing 1–4 of 4</span>
          <span className="flex gap-2">
            <span className="text-zinc-600">Prev</span>
            <span className="text-zinc-600">Next</span>
          </span>
        </div>
      </div>
    </>
  );
}

const SCREEN_META: Record<
  DashboardShowcaseScreen,
  { title: string; showExport?: boolean; designHeight: number }
> = {
  orders: { title: "Live Orders", designHeight: 640 },
  kitchen: { title: "Prep Display", designHeight: 640 },
  tables: { title: "Tables", designHeight: 620 },
  "waiter-calls": { title: "Waiter Calls", designHeight: 560 },
  history: { title: "History", showExport: true, designHeight: 660 },
  menu: { title: "Menu", designHeight: 560 },
  settings: { title: "Settings", designHeight: 560 },
};

export function DashboardScreenShowcase({
  screen,
  className,
  variant = "feature",
  theme = "dark",
}: {
  screen: DashboardShowcaseScreen;
  className?: string;
  variant?: "feature" | "hero";
  theme?: ShowcaseTheme;
}) {
  const meta = SCREEN_META[screen];
  const isHero = variant === "hero";
  const designHeight = isHero ? 520 : meta.designHeight;

  return (
    <ScaledDashboardPreview
      designHeight={designHeight}
      className={className}
    >
      <ShowcaseDashboardShell
        activeScreen={screen}
        title={meta.title}
        todayRevenue={DEMO_TODAY_REVENUE}
        currency={DEMO_CURRENCY}
        showExport={meta.showExport && !isHero}
        compact={isHero}
        theme={theme}
      >
        {screen === "orders" && (
          <OrdersBoardContent variant={isHero ? "hero" : "feature"} theme={theme} />
        )}
        {screen === "tables" && <TablesShowcaseContent compact={isHero} theme={theme} />}
        {screen === "history" && <HistoryShowcaseContent theme={theme} />}
      </ShowcaseDashboardShell>
    </ScaledDashboardPreview>
  );
}
