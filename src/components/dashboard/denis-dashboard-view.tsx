"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ActionableInsightsWidget } from "@/components/admin/analytics/actionable-insights-widget";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import { StaffCopilotTableList } from "@/components/dashboard/denis-staff-copilot-parts";
import { FloorGraphLiveMap } from "@/components/dashboard/floor-graph-live-map";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useAiInsights } from "@/hooks/use-ai-insights";
import { useDenisStaffCopilot } from "@/hooks/use-denis-staff-copilot";
import { useFloorGraph } from "@/hooks/use-floor-graph";
import type { AiInsightsRange } from "@/lib/dashboard/ai-insights-data";
import {
  setDenisKdsStress,
  setDenisOperatingMode,
  upsertDenisStaffTableHint,
} from "@/lib/denis/venue/ops/staff-ops-actions";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{ value: AiInsightsRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
];

const MODE_OPTIONS: Array<{ value: VenueOperatingMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "rush", label: "Rush" },
  { value: "kitchen_closed", label: "Kitchen closed" },
];

function guestLabel(count: number) {
  return count === 1 ? "1 Gast" : `${count} Gäste`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
      {children}
    </p>
  );
}

function InsightBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function DenisDashboardView() {
  const { currency } = useDashboard();
  const {
    data: insights,
    loading: insightsLoading,
    error: insightsError,
    range,
    setRange,
  } = useAiInsights("today");
  const { data: copilot, loading: copilotLoading, error: copilotError, refresh } =
    useDenisStaffCopilot();
  const {
    data: floorGraph,
    loading: floorGraphLoading,
    error: floorGraphError,
  } = useFloorGraph();
  const [pending, startTransition] = useTransition();
  const [hintTableId, setHintTableId] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintVisibility, setHintVisibility] = useState<
    "denis_only" | "guest_safe"
  >("denis_only");

  const activeTables = useMemo(
    () => (copilot?.tables ?? []).filter((table) => table.hasActiveSession),
    [copilot?.tables]
  );

  const loading = (insightsLoading && !insights) || (copilotLoading && !copilot);

  if (loading) {
    return (
      <Skeleton className="h-[640px] w-full rounded-xl bg-dash-surface-raised" />
    );
  }

  if (insightsError && !insights?.enabled) {
    return (
      <QrCard variant="muted" padding="md">
        <p className="text-sm text-dash-text-muted">{insightsError}</p>
      </QrCard>
    );
  }

  if (!insights?.enabled) {
    return (
      <QrCard variant="muted" padding="lg" className="text-center">
        <DenisMarkBadge
          size="lg"
          className="mx-auto bg-dash-accent-muted ring-dash-border-subtle"
        />
        <p className="mt-3 text-sm text-dash-text-muted">
          Denis is not enabled for this location.
        </p>
      </QrCard>
    );
  }

  const { summary, menuGaps, topProducts, alerts, actionableInsights, dailyBriefingLine } =
    insights;
  const conversionPct = Math.round(summary.conversionRate * 100);
  const backlogHigh =
    copilot?.kdsBacklogMinutes != null &&
    copilot.kdsBacklogMinutes >= (copilot.autoRushBacklogMinutes ?? 0);

  function applyMode(mode: VenueOperatingMode) {
    startTransition(async () => {
      const result = await setDenisOperatingMode(mode);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Operating mode: ${mode}`);
      await refresh();
    });
  }

  function applyKdsStress(stress: "normal" | "high") {
    startTransition(async () => {
      const result = await setDenisKdsStress(stress);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`KDS stress: ${stress}`);
      await refresh();
    });
  }

  function submitHint() {
    if (!hintTableId || !hintText.trim()) {
      toast.error("Pick a table and enter hint text.");
      return;
    }

    startTransition(async () => {
      const result = await upsertDenisStaffTableHint({
        tableId: hintTableId,
        text: hintText.trim(),
        visibility: hintVisibility,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Table hint saved for Denis.");
      setHintText("");
      await refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <QrCard variant="muted" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dash-border px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <DenisMarkBadge
              size="md"
              className="mt-0.5 bg-dash-accent-muted ring-dash-border-subtle"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-dash-text md:text-xl">
                Denis
              </h2>
              <p className="mt-0.5 text-sm text-dash-text-muted">
                Performance, floor ops, and table hints
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="relative">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as AiInsightsRange)}
                className="appearance-none rounded-lg border border-dash-surface-overlay bg-dash-bg py-2 pe-8 ps-3 text-xs font-medium text-dash-text-secondary outline-none focus:border-dash-accent/50"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-dash-text-disabled" />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || copilotLoading}
              onClick={() => void refresh()}
              className="min-h-11 gap-2"
            >
              <RefreshCw
                className={cn("size-4", (pending || copilotLoading) && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-dash-border border-b border-dash-border bg-dash-bg/40 sm:grid-cols-4">
          {[
            {
              label: "Denis-Umsatz",
              value: formatPrice(summary.aiRevenue, currency),
              accent: false,
            },
            {
              label: "Konversion",
              value: `${conversionPct}%`,
              accent: true,
            },
            {
              label: "Empfehlungen",
              value: `${summary.addedCount}/${summary.recommendedCount} hinzugefügt`,
              accent: false,
            },
            {
              label: "Bewertung",
              value:
                summary.averageRating != null
                  ? summary.averageRating.toFixed(1)
                  : "—",
              accent: false,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="px-4 py-4 md:px-5">
              <p className="text-xs text-dash-text-disabled">{kpi.label}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums md:text-xl",
                  kpi.accent ? "text-dash-accent" : "text-dash-text"
                )}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        <div className="border-b border-dash-border px-4 py-4 md:px-6">
          <InsightBlock title="Actionable insights">
            <ActionableInsightsWidget
              insights={actionableInsights ?? []}
              dailyBriefingLine={dailyBriefingLine}
            />
          </InsightBlock>
        </div>

        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-dash-border">
          <div className="space-y-5 border-b border-dash-border p-4 md:p-6 lg:border-b-0">
            <InsightBlock title="Menu gaps">
              {menuGaps.length === 0 ? (
                <p className="text-sm text-dash-text-disabled">
                  Keine Lücken erkannt.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {menuGaps.map((gap) => (
                    <li
                      key={gap.term}
                      className="text-sm text-dash-text-secondary before:me-2 before:text-dash-text-disabled before:content-['•']"
                    >
                      &quot;{gap.term}&quot; — {guestLabel(gap.count)}
                    </li>
                  ))}
                </ul>
              )}
            </InsightBlock>

            <InsightBlock title="Top Denis-Verkäufe">
              {topProducts.length === 0 ? (
                <p className="text-sm text-dash-text-disabled">
                  Noch keine Denis-Conversions.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {topProducts.map((product, index) => (
                    <li
                      key={product.productId}
                      className="text-sm text-dash-text-secondary"
                    >
                      {index + 1}. {product.name}{" "}
                      <span className="text-dash-text-disabled">
                        ({product.count}x)
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </InsightBlock>

            <InsightBlock title="Hinweise">
              {alerts.length === 0 ? (
                <p className="text-sm text-dash-text-disabled">
                  Alles im grünen Bereich.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {alerts.map((alert) => (
                    <li
                      key={`${alert.label}-${alert.detail}`}
                      className={cn(
                        "text-sm before:me-2 before:content-['•']",
                        alert.severity === "critical"
                          ? "text-red-300 before:text-red-400"
                          : alert.severity === "warning"
                            ? "text-amber-200 before:text-amber-400"
                            : "text-dash-text-secondary before:text-dash-text-disabled"
                      )}
                    >
                      {alert.label}: {alert.detail}
                    </li>
                  ))}
                </ul>
              )}
            </InsightBlock>
          </div>

          <div className="space-y-5 p-4 md:p-6">
            {copilotError ? (
              <p className="text-sm text-dash-text-muted">{copilotError}</p>
            ) : copilot?.enabled ? (
              <>
                <div>
                  <SectionHeading>House status</SectionHeading>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs text-dash-text-disabled">KDS backlog</p>
                      <p
                        className={cn(
                          "mt-1 text-lg font-bold tabular-nums",
                          backlogHigh ? "text-red-300" : "text-dash-text"
                        )}
                      >
                        {copilot.kdsBacklogMinutes != null
                          ? `${copilot.kdsBacklogMinutes} min`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dash-text-disabled">Active orders</p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-dash-text">
                        {copilot.activeOrderCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dash-text-disabled">Operating mode</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-dash-text-secondary">
                        {copilot.operatingMode.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dash-text-disabled">KDS stress</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-dash-text-secondary">
                        {copilot.kdsStress}
                      </p>
                    </div>
                  </div>
                  {copilot.autoRushEnabled && backlogHigh ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-amber-200">
                      <AlertTriangle className="size-4 shrink-0" />
                      {copilot.rushModeSuggestion ??
                        `Backlog exceeds auto-rush threshold (${copilot.autoRushBacklogMinutes} min).`}
                    </p>
                  ) : null}
                  {copilot.gatheringHint ? (
                    <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      {copilot.gatheringHint}
                    </p>
                  ) : null}
                  {copilot.inventoryBrief ? (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-xs leading-relaxed text-dash-text-secondary whitespace-pre-wrap">
                      {copilot.inventoryBrief}
                    </div>
                  ) : null}
                  {copilot.eventBlock ? (
                    <div className="mt-3 rounded-lg border border-dash-accent/30 bg-dash-accent/5 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
                        {copilot.eventBlock.title}
                      </p>
                      <pre className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-dash-text-secondary">
                        {copilot.eventBlock.lines.join("\n")}
                      </pre>
                    </div>
                  ) : null}
                  {copilot.learnedPairingsBlock ? (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 font-mono text-xs leading-relaxed text-dash-text-secondary whitespace-pre-wrap">
                      <p className="mb-1 font-sans text-[11px] font-medium uppercase tracking-wide text-emerald-200/80">
                        {copilot.learnedPairingsBlock.title}
                      </p>
                      {copilot.learnedPairingsBlock.lines.join("\n")}
                    </div>
                  ) : null}
                </div>

                {copilot.canManageOps ? (
                  <div>
                    <SectionHeading>Ops controls</SectionHeading>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="mb-2 text-xs text-dash-text-muted">Mode</p>
                        <div className="flex flex-wrap gap-2">
                          {MODE_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              size="sm"
                              variant={
                                copilot.operatingMode === option.value
                                  ? "default"
                                  : "outline"
                              }
                              disabled={pending}
                              className="min-h-11"
                              onClick={() => applyMode(option.value)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-dash-text-muted">
                          KDS stress
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(["normal", "high"] as const).map((stress) => (
                            <Button
                              key={stress}
                              type="button"
                              size="sm"
                              variant={
                                copilot.kdsStress === stress ? "default" : "outline"
                              }
                              disabled={pending}
                              className="min-h-11 capitalize"
                              onClick={() => applyKdsStress(stress)}
                            >
                              {stress}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-dash-text-muted">
                Floor ops data is unavailable for this location.
              </p>
            )}
          </div>
        </div>

        {copilot?.enabled ? (
          <>
            <div className="border-t border-dash-border p-4 md:p-6">
              <FloorGraphLiveMap
                data={floorGraph}
                loading={floorGraphLoading}
                error={floorGraphError}
              />
            </div>

            <div className="border-t border-dash-border p-4 md:p-6">
              <SectionHeading>Priority tables</SectionHeading>
              <div className="mt-3">
                <StaffCopilotTableList
                  tables={copilot.priorityTables}
                  emptyMessage="No tables need attention right now."
                />
              </div>
            </div>

            {copilot.canSetTableHints ? (
              <div className="border-t border-dash-border p-4 md:p-6">
                <SectionHeading>Table hint for Denis</SectionHeading>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-dash-text-muted">
                      Table
                    </span>
                    <select
                      value={hintTableId}
                      onChange={(e) => setHintTableId(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm text-dash-text outline-none focus:border-dash-accent/50"
                    >
                      <option value="">Select table…</option>
                      {(activeTables.length ? activeTables : copilot.tables).map(
                        (table) => (
                          <option key={table.tableId} value={table.tableId}>
                            {table.tableName}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-dash-text-muted">
                      Visibility
                    </span>
                    <select
                      value={hintVisibility}
                      onChange={(e) =>
                        setHintVisibility(
                          e.target.value as "denis_only" | "guest_safe"
                        )
                      }
                      className="mt-1 min-h-11 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm text-dash-text outline-none focus:border-dash-accent/50"
                    >
                      <option value="denis_only">Denis only (internal)</option>
                      <option value="guest_safe">
                        Guest-safe (may appear in chat)
                      </option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-dash-text-muted">
                    Hint
                  </span>
                  <textarea
                    value={hintText}
                    onChange={(e) => setHintText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. VIP birthday — offer complimentary dessert if they ask"
                    className="mt-1 w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent/50"
                  />
                </label>
                <Button
                  type="button"
                  disabled={pending}
                  className="mt-3 min-h-11"
                  onClick={submitHint}
                >
                  Save hint
                </Button>
              </div>
            ) : null}

            <div className="border-t border-dash-border px-4 py-2.5 md:px-6">
              <p className="text-[11px] text-dash-text-disabled">
                Snapshot at {new Date(copilot.at).toLocaleTimeString()} · refreshes
                every 30s
                {!copilot.floorGraphEnabled
                  ? " · enable ops.floorGraphEnabled for auto-rush"
                  : ""}
              </p>
            </div>
          </>
        ) : null}
      </QrCard>
    </div>
  );
}
