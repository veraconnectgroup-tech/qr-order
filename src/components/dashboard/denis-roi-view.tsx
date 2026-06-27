"use client";

import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { ExperienceScoreWidget } from "@/components/dashboard/experience-score-widget";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDenisRoi, type DenisRoiRange } from "@/hooks/use-denis-roi";
import {
  formatOrderDuration,
  formatRoiRatio,
} from "@/lib/dashboard/denis-roi";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{ value: DenisRoiRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function ChangeBadge({
  value,
  suffix = "%",
  isPp = false,
}: {
  value: number;
  suffix?: string;
  isPp?: boolean;
}) {
  const positive = value >= 0;
  const formatted = isPp
    ? `${positive ? "+" : ""}${value.toFixed(1)}pp`
    : `${Math.abs(value).toFixed(1)}${suffix}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        positive ? "text-emerald-400" : "text-red-400"
      )}
    >
      {positive ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : (
        <ArrowDown className="size-3" aria-hidden />
      )}
      {formatted} vs prev
    </span>
  );
}

function KpiCard({
  label,
  value,
  change,
  isPp,
}: {
  label: string;
  value: string;
  change?: number;
  isPp?: boolean;
}) {
  return (
    <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
      <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold text-dash-text-primary sm:text-3xl">
        {value}
      </p>
      {change !== undefined && (
        <div className="mt-2">
          <ChangeBadge value={change} isPp={isPp} />
        </div>
      )}
    </QrCard>
  );
}

function MiniTrendBar({
  label,
  points,
  maxValue,
  formatValue,
}: {
  label: string;
  points: number[];
  maxValue: number;
  formatValue: (v: number) => string;
}) {
  const peak = maxValue > 0 ? maxValue : Math.max(...points, 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-dash-text-secondary">{label}</p>
        <p className="font-mono text-xs text-dash-text-disabled">
          {points.length > 0 ? formatValue(points[points.length - 1] ?? 0) : "—"}
        </p>
      </div>
      <div className="flex h-8 items-end gap-px">
        {points.map((value, index) => (
          <div
            key={index}
            className="min-w-[2px] flex-1 rounded-sm bg-dash-accent/70"
            style={{ height: `${Math.max(4, (value / peak) * 100)}%` }}
            title={formatValue(value)}
          />
        ))}
      </div>
    </div>
  );
}

function ImpactRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dash-border-subtle py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-dash-text-secondary">
          <span aria-hidden className="mr-1.5">
            {icon}
          </span>
          {label}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-dash-text-disabled">{hint}</p>
        )}
      </div>
      <p className="shrink-0 font-mono text-sm font-semibold text-dash-text-primary">
        {value}
      </p>
    </div>
  );
}

export function DenisRoiView() {
  const { currency } = useDashboard();
  const { data, loading, error, range, setRange, refresh } = useDenisRoi("30d");

  const periodLabel =
    data?.period.start && data?.period.end
      ? `${data.period.start} — ${data.period.end}`
      : "";

  const revenuePoints = data?.daily.map((d) => d.revenue) ?? [];
  const sessionPoints = data?.daily.map((d) => d.sessions) ?? [];
  const convPoints = data?.daily.map((d) => d.conversionRate * 100) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <DenisMarkBadge size="md" />
          <div>
            <h1 className="text-xl font-bold text-dash-text-primary sm:text-2xl">
              Denis ROI
            </h1>
            <p className="mt-1 text-sm text-dash-text-secondary">
              How much Denis earns for your venue
              {periodLabel ? ` · ${periodLabel}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-dash-border-subtle bg-dash-surface p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  range === opt.value
                    ? "bg-dash-accent text-white"
                    : "text-dash-text-secondary hover:text-dash-text-primary"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            className="text-dash-text-secondary"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {error && (
        <QrCard className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </QrCard>
      )}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-dash-surface" />
          ))}
        </div>
      ) : data ? (
        <>
          <ExperienceScoreWidget
            snapshot={data.experienceScore}
            loading={loading}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Revenue"
              value={formatPrice(data.revenue.total, currency)}
              change={data.revenue.vsPrevious}
            />
            <KpiCard
              label="Sessions"
              value={data.sessions.total.toLocaleString()}
              change={data.sessions.vsPrevious}
              isPp
            />
            <KpiCard
              label="Conversion"
              value={`${(data.sessions.conversionRate * 100).toFixed(1)}%`}
              change={data.sessions.conversionVsPrevious}
              isPp
            />
          </div>

          <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
            <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Denis impact
            </p>
            <div className="mt-2">
              <ImpactRow
                icon="🍺"
                label="Upsell revenue"
                value={`${formatPrice(data.revenue.denisUpsell, currency)} (${data.revenue.upsellPercent.toFixed(1)}% of total)`}
              />
              <ImpactRow
                icon="⏱️"
                label="Avg order time"
                value={formatOrderDuration(data.sessions.avgOrderTimeSeconds)}
                hint="From session open to first order"
              />
              <ImpactRow
                icon="🔄"
                label="Return guest rate"
                value={`${(data.guests.returningPercent * 100).toFixed(0)}%`}
                hint="Denis remembers returning guests"
              />
              <ImpactRow
                icon="🤖"
                label="T0 reflex rate"
                value={`${(data.cost.t0Percent * 100).toFixed(0)}%`}
                hint="No LLM cost"
              />
              <ImpactRow
                icon="💸"
                label="AI cost"
                value={`${formatPrice(data.cost.totalAiCost, currency)} (${formatPrice(data.cost.costPerSession, currency)}/session)`}
              />
              <ImpactRow
                icon="📈"
                label="ROI"
                value={formatRoiRatio(data.cost.roi)}
                hint="Upsell revenue ÷ AI cost"
              />
            </div>
          </QrCard>

          <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Trending
            </p>
            <div className="space-y-5">
              <MiniTrendBar
                label="Revenue"
                points={revenuePoints}
                maxValue={Math.max(...revenuePoints, 0)}
                formatValue={(v) => formatPrice(v, currency)}
              />
              <MiniTrendBar
                label="Sessions"
                points={sessionPoints}
                maxValue={Math.max(...sessionPoints, 0)}
                formatValue={(v) => String(Math.round(v))}
              />
              <MiniTrendBar
                label="Conversion %"
                points={convPoints}
                maxValue={100}
                formatValue={(v) => `${v.toFixed(1)}%`}
              />
            </div>
          </QrCard>

          {data.topPerformers.length > 0 && (
            <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                Top performers
              </p>
              <ol className="space-y-2">
                {data.topPerformers.map((row, index) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-dash-text-secondary">
                      <span className="mr-2 font-mono text-dash-text-disabled">
                        {index + 1}.
                      </span>
                      {row.category}
                    </span>
                    <span className="font-mono text-dash-text-primary">
                      {row.accepted} accepted ·{" "}
                      {formatPrice(row.revenue, currency)}
                    </span>
                  </li>
                ))}
              </ol>
            </QrCard>
          )}
        </>
      ) : null}
    </div>
  );
}
