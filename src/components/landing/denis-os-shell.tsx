"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  ChefHat,
  Grid3X3,
  LayoutGrid,
  Settings,
  UtensilsCrossed,
  Waypoints,
} from "lucide-react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { TablesShowcaseContent } from "@/components/landing/dashboard-screen-showcase";
import {
  DEMO_CURRENCY,
  DEMO_DASHBOARD_CONTEXT,
  DEMO_KITCHEN_ORDERS,
  DEMO_NOW_MS,
  DEMO_TABLES,
  DEMO_TODAY_REVENUE,
} from "@/components/landing/demo-data";
import { GuestMenuContent, OrdersBoardContent } from "@/components/landing/showcase-content";
import { ShowcaseKitchenCard } from "@/components/landing/showcase-static/showcase-kitchen-card";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type OsView = "operations" | "floor" | "kitchen" | "denis" | "guest";

const DEMO_CLOCK = new Date(DEMO_NOW_MS).toLocaleTimeString("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

const NAV: {
  id: OsView;
  label: string;
  icon: typeof LayoutGrid;
  badge?: string;
}[] = [
  { id: "operations", label: "Orders", icon: LayoutGrid, badge: "3" },
  { id: "floor", label: "Floor", icon: Grid3X3, badge: "!" },
  { id: "kitchen", label: "Prep", icon: ChefHat, badge: "2" },
  { id: "denis", label: "Denis", icon: Waypoints },
  { id: "guest", label: "Guest", icon: UtensilsCrossed },
];

const SECONDARY_NAV = [
  { label: "History", icon: BarChart3 },
  { label: "Settings", icon: Settings },
] as const;

function OsFloorRail() {
  const tables = DEMO_TABLES.filter((t) =>
    ["t7", "t9", "t5", "t10", "t4", "t8"].includes(t.id)
  );

  return (
    <section className="border-b border-[var(--qr-border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
          Floor routing
        </p>
        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
          <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
          Live
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {tables.map((table) => (
          <div
            key={table.id}
            className={cn(
              "rounded-lg border px-2 py-2 text-center",
              table.status === "attention" &&
                "border-red-500/60 bg-red-500/[0.06]",
              table.status === "occupied" &&
                "border-emerald-500/30 bg-[var(--qr-surface)]",
              table.status === "available" &&
                "border-[var(--qr-border-subtle)] bg-[var(--qr-surface)]/60"
            )}
          >
            <p className="font-mono text-[11px] font-semibold text-[var(--qr-ivory)]">
              {table.name.replace("Table ", "T").replace("Terrace ", "Tr")}
            </p>
            <p className="mt-1 text-[9px] capitalize text-[var(--qr-muted)]">
              {table.status === "attention"
                ? "Call"
                : table.status === "occupied"
                  ? formatPrice(table.sessionTotal ?? 0, DEMO_CURRENCY)
                  : "Open"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OsKitchenRail() {
  return (
    <section className="border-b border-[var(--qr-border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
          Prep display
        </p>
        <span className="font-mono text-[10px] tabular-nums text-[var(--qr-muted)]">
          {DEMO_KITCHEN_ORDERS.length} active
        </span>
      </div>
      <div className="space-y-2 [&_article]:p-3 [&_p.text-2xl]:text-lg [&_li]:text-xs">
        {DEMO_KITCHEN_ORDERS.slice(0, 2).map((order) => (
          <ShowcaseKitchenCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}

function OsDenisRail() {
  return (
    <section className="border-b border-[var(--qr-border-subtle)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <DenisBrandMark markOnly markSize={24} markState="think" className="!gap-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
            Operational intelligence
          </p>
          <p className="text-[11px] text-[var(--qr-muted)]">Table 8 · routing</p>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--qr-border-subtle)] bg-[var(--qr-surface)] p-3">
        <p className="text-sm font-medium leading-snug text-[var(--qr-ivory)]">
          Caesar salad before mains
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--qr-muted)]">
          ~12 min prep · complements spritz order on T8
        </p>
        <p className="mt-3 text-[11px] font-medium text-[var(--qr-ember)]">
          Route to kitchen
        </p>
      </div>
    </section>
  );
}

function OsGuestRail() {
  return (
    <section className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
          Guest channel
        </p>
        <span className="text-[10px] text-[var(--qr-muted)]">QR · Table 8</span>
      </div>
      <div className="rounded-lg border border-[var(--qr-border-subtle)] bg-[var(--qr-surface)] px-3 py-2.5">
        <p className="text-xs text-[var(--qr-ivory)]">2 items in cart</p>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--qr-muted)]">
          {formatPrice(21.5, DEMO_CURRENCY)} · ordering
        </p>
      </div>
    </section>
  );
}

function OsActivityStrip() {
  return (
    <div className="flex shrink-0 items-center gap-4 overflow-x-auto border-b border-[var(--qr-border-subtle)] bg-[var(--qr-surface)]/40 px-4 py-2 text-[11px] text-[var(--qr-muted)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0">
        <span className="font-mono text-[var(--qr-ember)]">{formatOrderNumber(847)}</span>
        {" · "}Table 6 ·{" "}
        <span className="text-[var(--qr-ivory)]">new</span>
      </span>
      <span className="shrink-0 text-[var(--qr-border-subtle)]">|</span>
      <span className="shrink-0">
        T8 · <span className="text-red-400">waiter call</span>
      </span>
      <span className="shrink-0 text-[var(--qr-border-subtle)]">|</span>
      <span className="shrink-0">
        Prep · <span className="text-[var(--qr-ivory)]">2 tickets</span>
      </span>
      <span className="shrink-0 text-[var(--qr-border-subtle)]">|</span>
      <span className="shrink-0">
        Denis · <span className="text-[var(--qr-ivory)]">suggestion queued</span>
      </span>
    </div>
  );
}

function OsWorkspace({ view }: { view: OsView }) {
  if (view === "floor") {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <TablesShowcaseContent compact theme="dark" />
      </div>
    );
  }

  if (view === "kitchen") {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--qr-void)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
              Prep display
            </p>
            <p className="text-lg font-semibold text-[var(--qr-ivory)]">Skyline Lounge</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            ● Live
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DEMO_KITCHEN_ORDERS.map((order) => (
            <ShowcaseKitchenCard key={order.id} order={order} />
          ))}
        </div>
      </div>
    );
  }

  if (view === "denis") {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <DenisBrandMark markState="think" className="mb-8" />
          <div className="space-y-3">
            {[
              {
                table: "Table 8",
                title: "Caesar salad before mains",
                detail: "~12 min · guest cart has 2 cocktails · upsell window open",
                action: "Route to kitchen",
              },
              {
                table: "Terrace 5",
                title: "Dessert timing after mains",
                detail: "Order #844 preparing · suggest tiramisu in 8 min",
                action: "Surface to guest",
              },
              {
                table: "Table 6",
                title: "New order · accept window",
                detail: `${formatOrderNumber(847)} · 2 drinks + Hugo · staff idle on floor`,
                action: "Accept order",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--qr-border-subtle)] bg-[var(--qr-surface)] p-4"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--qr-muted)]">
                  {item.table}
                </p>
                <p className="mt-2 text-base font-medium text-[var(--qr-ivory)]">
                  {item.title}
                </p>
                <p className="mt-1.5 text-sm text-[var(--qr-muted)]">{item.detail}</p>
                <p className="mt-3 text-xs font-medium text-[var(--qr-ember)]">
                  {item.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "guest") {
    return (
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[var(--qr-void)] p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--qr-border-subtle)] bg-[var(--qr-surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <GuestMenuContent variant="cinematic" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-hidden">
        <OrdersBoardContent variant="feature" theme="dark" />
      </div>
      <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-[var(--qr-border-subtle)] bg-[var(--qr-void)] xl:block 2xl:w-[300px]">
        <OsFloorRail />
        <OsKitchenRail />
        <OsDenisRail />
        <OsGuestRail />
      </aside>
    </div>
  );
}

/** Public entry — Denis as operating system, not marketing site. */
export function DenisOsShell() {
  const [view, setView] = useState<OsView>("operations");
  const activeNav = NAV.find((item) => item.id === view) ?? NAV[0];

  return (
    <div className="dashboard-theme flex h-dvh min-h-dvh flex-col overflow-hidden bg-[var(--qr-void)] text-[var(--qr-ivory)] antialiased md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--qr-border-subtle)] bg-[var(--qr-surface)] md:w-[260px] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--qr-border-subtle)] px-4 py-3 md:block md:px-5 md:py-4">
          <Link href="/" className="min-w-0">
            <DenisBrandMark />
          </Link>
          <div className="text-right md:mt-3 md:text-left">
            <p className="truncate text-sm font-semibold text-[var(--qr-ivory)]">
              {DEMO_DASHBOARD_CONTEXT.orgName}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-emerald-500 md:justify-start">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
              Service open
            </p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:px-3 md:py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="mb-1 hidden px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--qr-muted)] md:block">
            Operations
          </p>
          {NAV.map(({ id, label, icon: Icon, badge }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition md:w-full",
                  active
                    ? "border-l-2 border-[var(--qr-ember)] bg-[var(--qr-ember-muted)] pl-2 text-[var(--qr-ivory)]"
                    : "border-l-2 border-transparent text-[var(--qr-muted)] hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
                {badge ? (
                  <span
                    className={cn(
                      "ml-auto hidden rounded-full px-1.5 py-0.5 font-mono text-[10px] md:inline",
                      active
                        ? "bg-[var(--qr-ember)]/20 text-[var(--qr-ember)]"
                        : "bg-[var(--qr-elevated)] text-[var(--qr-muted)]"
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <p className="mb-1 mt-4 hidden px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--qr-muted)] md:block">
            System
          </p>
          {SECONDARY_NAV.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="hidden items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-[13px] text-[var(--qr-muted)] md:flex"
            >
              <Icon className="size-3.5 shrink-0 opacity-60" />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-[var(--qr-border-subtle)] p-3 md:block">
          <div className="rounded-lg bg-[var(--qr-elevated)] p-3">
            <p className="text-[10px] text-[var(--qr-muted)]">Staff</p>
            <p className="mt-0.5 text-xs font-medium text-[var(--qr-ivory)]">
              {DEMO_DASHBOARD_CONTEXT.staffName}
            </p>
            <p className="text-[10px] capitalize text-[var(--qr-muted)]">
              {DEMO_DASHBOARD_CONTEXT.staffRole}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Link
              href="/login"
              className="rounded-lg px-2.5 py-2 text-[12px] text-[var(--qr-muted)] transition hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--qr-ember)] px-2.5 py-2 text-center text-[12px] font-medium text-white transition hover:bg-[var(--qr-ember-hover)]"
            >
              Open Denis
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--qr-border-subtle)] bg-[var(--qr-void)] px-4 py-2.5 md:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--qr-ivory)]">
              {activeNav.label}
            </p>
            <p className="truncate text-[11px] text-[var(--qr-muted)]">
              denis.app / {DEMO_DASHBOARD_CONTEXT.orgSlug} / {view}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-[var(--qr-muted)]">
            <span className="hidden font-mono tabular-nums sm:inline">{DEMO_CLOCK}</span>
            <span className="hidden h-3 w-px bg-[var(--qr-border-subtle)] sm:block" />
            <span className="font-mono tabular-nums text-[var(--qr-ivory)]">
              {formatPrice(DEMO_TODAY_REVENUE, DEMO_CURRENCY)}
            </span>
            <span className="flex items-center gap-1 text-emerald-500">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
              Live
            </span>
          </div>
        </header>

        <OsActivityStrip />
        <OsWorkspace view={view} />
      </div>
    </div>
  );
}
