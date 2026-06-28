"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import type { ThresholdOptimizationSnapshot } from "@/lib/admin/load-threshold-optimization";
import { Button } from "@/components/ui/button";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
};

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function ConversionChart({
  series,
}: {
  series: ThresholdOptimizationSnapshot["conversionSeries"][number];
}) {
  const chartData = series.buckets.map((bucket) => ({
    label: bucket.label,
    conversionPct: Math.round(bucket.conversionRate * 1000) / 10,
    sampleSize: bucket.sampleSize,
    eligible: bucket.eligible,
    isCurrent: bucket.representativeMinutes === series.currentValue,
  }));

  return (
    <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-dash-text-primary">
            {series.label}
          </h3>
          <p className="mt-1 text-xs text-dash-text-disabled">
            Trenutno: {series.currentValue} min · min 50 uzoraka po bucketu
          </p>
        </div>
      </div>

      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              unit="%"
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value, _name, item) => {
                const payload = item.payload as (typeof chartData)[number];
                return [
                  `${value}% (n=${payload.sampleSize})`,
                  payload.eligible ? "Konverzija" : "Premalo uzoraka",
                ];
              }}
            />
            <Bar dataKey="conversionPct" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={
                    entry.isCurrent
                      ? "#f97316"
                      : entry.eligible
                        ? "#52525b"
                        : "#3f3f46"
                  }
                  opacity={entry.eligible ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </QrCard>
  );
}

export function ThresholdOptimizationView({
  snapshot,
}: {
  snapshot: ThresholdOptimizationSnapshot;
}) {
  const hasData = snapshot.conversionSeries.some((row) =>
    row.buckets.some((bucket) => bucket.sampleSize > 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <DenisMarkBadge className="mt-0.5 size-9 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-dash-text-primary">
              Timing optimizacija
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-dash-text-secondary">
              Denis prati konverzije po minutu za svaki proactive nudge i predlaže
              optimalne thresholdove. Poslednjih {snapshot.periodDays} dana.
            </p>
          </div>
        </div>
        <Gauge className="size-6 text-dash-accent" aria-hidden />
      </div>

      {snapshot.summary ? (
        <div className="rounded-xl border border-dash-accent/30 bg-dash-accent/10 px-4 py-3">
          <p className="text-sm font-semibold text-dash-text-primary">
            Denis predlog
          </p>
          <p className="mt-1 text-sm text-dash-text-secondary">{snapshot.summary}</p>
          {!snapshot.autoApply && (
            <p className="mt-2 text-xs text-dash-text-disabled">
              Auto-primena je isključena — odobrenje u Admin → Denis Insights.
            </p>
          )}
        </div>
      ) : null}

      {!hasData ? (
        <QrCard className="border-dashed border-dash-border-subtle bg-dash-surface-raised p-6">
          <p className="text-sm text-dash-text-secondary">
            Još nema dovoljno nudge podataka. Potrebno je najmanje 50 uzoraka po
            timing bucketu pre nego što Denis predloži promenu.
          </p>
        </QrCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.conversionSeries.map((series) => (
            <ConversionChart key={series.key} series={series} />
          ))}
        </div>
      )}

      {snapshot.metrics.length > 0 ? (
        <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
          <h2 className="text-sm font-semibold text-dash-text-primary">
            Analiza po thresholdu
          </h2>
          <ul className="mt-3 space-y-3">
            {snapshot.metrics.map((row) => (
              <li
                key={row.key}
                className="rounded-lg border border-dash-border-subtle bg-dash-surface px-3 py-2 text-sm"
              >
                <p className="font-medium text-dash-text-primary">
                  {row.key}: {row.currentValue}min → optimal {row.optimalValue}min
                </p>
                <p className="mt-1 text-dash-text-secondary">
                  Konverzija {pct(row.conversionAtCurrent)} → {pct(row.conversionAtOptimal)}{" "}
                  · n={row.sampleSize} · confidence {pct(row.confidence)}
                </p>
              </li>
            ))}
          </ul>
        </QrCard>
      ) : null}

      {snapshot.suggestions.length > 0 && !snapshot.autoApply ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/admin/denis-insights">Odobri u Adminu</Link>
          </Button>
          <p className="text-xs text-dash-text-disabled">
            Promene se ne primenjuju automatski dok vlasnik ne odobri.
          </p>
        </div>
      ) : null}
    </div>
  );
}
