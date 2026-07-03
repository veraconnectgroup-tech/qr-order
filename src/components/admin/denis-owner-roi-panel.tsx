"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import type { DenisOwnerRoiDashboard } from "@/lib/billing/denis-roi-tracker";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  if (hours < 1) return `${Math.round(minutes)}min`;
  return `${hours.toFixed(0)}h`;
}

function RoiBadge({ multiplier }: { multiplier: number }) {
  const healthy = multiplier >= 5 || multiplier === Infinity;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold",
        healthy
          ? "bg-emerald-500/15 text-emerald-400"
          : multiplier >= 1
            ? "bg-amber-500/15 text-amber-400"
            : "bg-red-500/15 text-red-400"
      )}
    >
      {multiplier === Infinity ? "∞" : `${multiplier}x`}
      {healthy ? " 🟢" : null}
    </span>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <QrCard className="border-dash-border-subtle bg-dash-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
        {icon} {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold text-dash-text-primary">
        {value}
      </p>
    </QrCard>
  );
}

export function DenisOwnerRoiPanel({
  dashboard,
  currency = "EUR",
}: {
  dashboard: DenisOwnerRoiDashboard;
  currency?: string;
}) {
  const { metrics, roi, plan, monthlyTrend, topContributions } = dashboard;

  const chartData = monthlyTrend.map((row) => ({
    label: row.month,
    roi: row.roiMultiplier,
    revenue: row.revenueEuros,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" />
        <div>
          <h2 className="text-lg font-semibold text-dash-text-primary">
            Denis ROI — {dashboard.period.monthLabel}
          </h2>
          <p className="text-sm text-dash-text-secondary">
            {dashboard.period.start} — {dashboard.period.end}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon="💰"
          label="Upsell revenue"
          value={formatPrice(metrics.upsellRevenueCents / 100, currency)}
        />
        <MetricTile
          icon="🔄"
          label="Win-back revenue"
          value={formatPrice(metrics.winBackRevenueCents / 100, currency)}
        />
        <MetricTile
          icon="⏱"
          label="Vreme sačuvano"
          value={formatHours(metrics.estimatedMinutesSaved)}
        />
        <MetricTile
          icon="🛡"
          label="Alergeni sprečeni"
          value={String(metrics.allergyWarnings + metrics.allergyBlocks)}
        />
      </div>

      <QrCard className="border-dash-accent/30 bg-dash-accent/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-dash-text-secondary">
              Vaš plan:{" "}
              <span className="font-semibold text-dash-text-primary">
                {plan.displayName}
              </span>{" "}
              ({formatPrice(plan.costEuros, currency)}/mesec)
            </p>
            <p className="mt-1 text-lg font-semibold text-dash-text-primary">
              Denis zarada ovog meseca:{" "}
              <span className="font-mono text-[var(--qr-ember)]">
                {formatPrice(dashboard.totalDenisRevenueEuros, currency)}
              </span>
            </p>
            <p className="mt-1 text-sm text-dash-text-muted">{roi.detail}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
              ROI
            </p>
            <div className="mt-1">
              <RoiBadge multiplier={roi.roiMultiplier} />
            </div>
          </div>
        </div>
      </QrCard>

      <QrCard className="border-dash-border-subtle bg-dash-surface-raised p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          ROI po mesecima
        </p>
        <p className="mb-4 text-xs text-dash-text-disabled">
          Denis upsell revenue vs plan cost
        </p>
        {chartData.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-dash-text-disabled">
            Još nema podataka za graf
          </p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${v}x`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    const numeric = Number(value ?? 0);
                    if (name === "roi") {
                      return [`${numeric}x`, "ROI"];
                    }
                    return [formatPrice(numeric, currency), "Revenue"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="var(--qr-ember)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--qr-ember)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </QrCard>

      {topContributions.length > 0 && (
        <QrCard className="border-dash-border-subtle bg-dash-surface-raised p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            Top Denis doprinosi
          </p>
          <ol className="space-y-3">
            {topContributions.map((row) => (
              <li
                key={`${row.rank}-${row.label}`}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-dash-text-primary">
                    <span className="mr-2 font-mono text-dash-text-disabled">
                      {row.rank}.
                    </span>
                    {row.label}: {row.detail}
                  </p>
                </div>
                {row.valueEuros != null && row.valueEuros > 0 && (
                  <p className="shrink-0 font-mono font-semibold text-[var(--qr-ember)]">
                    {formatPrice(row.valueEuros, currency)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </QrCard>
      )}
    </div>
  );
}
