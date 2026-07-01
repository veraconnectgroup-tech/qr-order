"use client";

import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExperienceScoreWidget } from "@/components/dashboard/experience-score-widget";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDenisRoi, type DenisRoiRange } from "@/hooks/use-denis-roi";
import {
  formatCostPerSession,
  formatOrderDuration,
  formatRoiRatio,
  formatWaiterHoursSaved,
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

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
};

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
    : `${positive ? "+" : ""}${Math.abs(value).toFixed(1)}${suffix}`;

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
  hint,
}: {
  label: string;
  value: string;
  change?: number;
  isPp?: boolean;
  hint?: string;
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
      {hint && (
        <p className="mt-1 text-xs text-dash-text-disabled">{hint}</p>
      )}
    </QrCard>
  );
}

function InsightBanner({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dash-accent/30 bg-dash-accent/10 px-4 py-3">
      <p className="text-sm font-semibold text-dash-text-primary">{title}</p>
      <p className="mt-1 text-sm text-dash-text-secondary">{body}</p>
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

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RevenueLineChart({
  daily,
  currency,
}: {
  daily: Array<{ date: string; revenue: number; upsellRevenue: number }>;
  currency: string;
}) {
  const chartData = daily.map((row) => ({
    label: formatShortDate(row.date),
    revenue: row.revenue,
    upsell: row.upsellRevenue,
  }));

  const hasData = chartData.some((row) => row.revenue > 0);

  if (!hasData) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-dash-text-disabled">
        No revenue in this period
      </p>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
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
            width={48}
            tickFormatter={(v: number) =>
              v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`
            }
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as {
                revenue: number;
                upsell: number;
              };
              return (
                <div className="rounded-lg border border-dash-surface-overlay bg-dash-surface px-2.5 py-1.5 text-xs shadow-lg">
                  <p className="font-mono font-semibold text-[var(--qr-ember)]">
                    {formatPrice(row.revenue, currency)}
                  </p>
                  <p className="text-dash-text-muted">
                    Upsell {formatPrice(row.upsell, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--qr-ember)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--qr-ember)" }}
          />
          <Line
            type="monotone"
            dataKey="upsell"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4, fill: "#a78bfa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExperienceScoreTrendChart({
  daily,
}: {
  daily: Array<{ date: string; experienceScore: number | null }>;
}) {
  const chartData = daily
    .filter((row) => row.experienceScore != null)
    .map((row) => ({
      label: formatShortDate(row.date),
      score: row.experienceScore as number,
    }));

  if (chartData.length === 0) {
    return (
      <p className="flex h-[180px] items-center justify-center text-sm text-dash-text-disabled">
        No experience scores yet
      </p>
    );
  }

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const score = Number(payload[0]?.value ?? 0);
              return (
                <div className="rounded-lg border border-dash-surface-overlay bg-dash-surface px-2.5 py-1.5 text-xs shadow-lg">
                  <p className="font-mono font-semibold text-emerald-400">
                    {score.toFixed(1)}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3, fill: "#34d399" }}
            activeDot={{ r: 5, fill: "#34d399" }}
          />
        </LineChart>
      </ResponsiveContainer>
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

  const weeklyHoursLabel =
    range === "7d"
      ? "ove nedelje"
      : range === "30d"
        ? "u poslednjih 30 dana"
        : "u poslednjih 90 dana";

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

          <div className="grid gap-3 sm:grid-cols-2">
            <InsightBanner
              title={`Denis uštedeo ${formatWaiterHoursSaved(data.savings.waiterHoursSaved)} konobarskog vremena ${weeklyHoursLabel}`}
              body={`${data.savings.waiterCallsSaved.toLocaleString()} poziva konobaru Denis je preuzeo — procena ${formatWaiterHoursSaved(data.savings.waiterHoursSaved)} manje obilaska stola.`}
            />
            <InsightBanner
              title={`${formatCostPerSession(data.cost.costPerSession)} po sesiji — isplati se od ${data.cost.breakEvenUpsellsPerDay} upsell-a dnevno`}
              body={`Denis košta ${data.cost.denisVsWaiterRatio > 0 ? `${data.cost.denisVsWaiterRatio}× manje` : "manje"} od jednog konobarskog odgovora · ${data.cost.tokensPerSession.toLocaleString()} tokena po sesiji`}
            />
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Revenue
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Upsell revenue"
                value={formatPrice(data.revenue.upsellRevenue, currency)}
                change={data.revenue.vsPrevious}
              />
              <KpiCard
                label="Saved orders"
                value={String(data.revenue.savedOrders.count)}
                hint={`${formatPrice(data.revenue.savedOrders.revenue, currency)} recovered from cart abandonment`}
              />
              <KpiCard
                label="Avg order increase"
                value={`${data.revenue.avgOrderIncreasePct >= 0 ? "+" : ""}${data.revenue.avgOrderIncreasePct.toFixed(1)}%`}
                hint={`Avg order ${formatPrice(data.revenueIntelligence.avgOrderValue, currency)}`}
              />
            </div>
          </div>

          <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Revenue by day
            </p>
            <p className="mb-4 text-xs text-dash-text-disabled">
              Solid line = total revenue · dashed = Denis upsell
            </p>
            <RevenueLineChart daily={data.daily} currency={currency} />
          </QrCard>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Savings
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Waiter calls saved"
                value={data.savings.waiterCallsSaved.toLocaleString()}
                hint={`≈ ${formatWaiterHoursSaved(data.savings.waiterHoursSaved)} floor time`}
              />
              <KpiCard
                label="Kitchen delays prevented"
                value={String(data.savings.kitchenDelayPrevented)}
                hint="Proactive capacity nudges accepted"
              />
              <KpiCard
                label="Allergy catches"
                value={String(data.savings.allergyCatches)}
                hint="Safe-menu filters before order"
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Satisfaction
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Experience score"
                value={
                  data.satisfaction.experienceScoreAvg != null
                    ? data.satisfaction.experienceScoreAvg.toFixed(1)
                    : "—"
                }
              />
              <KpiCard
                label="Review conversion"
                value={`${(data.satisfaction.reviewConversionRate * 100).toFixed(1)}%`}
                hint="Sessions → Google review click"
              />
              <KpiCard
                label="Return rate"
                value={`${(data.satisfaction.returnRate * 100).toFixed(0)}%`}
                hint="Denis remembers returning guests"
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Smart tips
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Avg tip"
                value={`${data.tips.avgTipPercent.toFixed(1)}%`}
                change={data.tips.avgTipVsPreviousPct}
              />
              <KpiCard
                label="Tips total"
                value={formatPrice(data.tips.tipTotal, "EUR")}
                hint={`${data.tips.tipCount} tips in period`}
              />
              <KpiCard
                label="Denis tip correlation"
                value={
                  data.tips.denisPromptCount > 0
                    ? `${(data.tips.denisCorrelation * 100).toFixed(0)}%`
                    : "—"
                }
                hint="Post-settle Denis prompt → tip"
              />
            </div>
          </div>

          <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Experience score trend
            </p>
            <ExperienceScoreTrendChart daily={data.daily} />
          </QrCard>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              AI cost
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Tokens per session"
                value={data.cost.tokensPerSession.toLocaleString()}
                hint={`${(data.cost.t0Percent * 100).toFixed(0)}% T0 reflex (no LLM)`}
              />
              <KpiCard
                label="Cost per session"
                value={formatCostPerSession(data.cost.costPerSession)}
                hint={`Total ${formatPrice(data.cost.totalAiCost, currency)}`}
              />
              <KpiCard
                label="Denis vs waiter"
                value={
                  data.cost.denisVsWaiterRatio > 0
                    ? `${data.cost.denisVsWaiterRatio}× cheaper`
                    : "—"
                }
                hint="Per interaction vs floor staff"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Total revenue"
              value={formatPrice(data.revenue.total, currency)}
              change={data.revenue.vsPrevious}
            />
            <KpiCard
              label="Sessions"
              value={data.sessions.total.toLocaleString()}
              change={data.sessions.vsPrevious}
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
              Revenue intelligence
            </p>
            <div className="mt-2">
              <ImpactRow
                icon="🧾"
                label="Avg order value"
                value={`${formatPrice(data.revenueIntelligence.avgOrderValue, currency)} (${data.revenueIntelligence.avgOrderVsPreviousPct >= 0 ? "+" : ""}${data.revenueIntelligence.avgOrderVsPreviousPct.toFixed(1)}% vs prev)`}
              />
              <ImpactRow
                icon="🍺"
                label="Denis upsell contribution"
                value={formatPrice(
                  data.revenueIntelligence.denisUpsellContribution,
                  currency
                )}
              />
              {data.revenueIntelligence.lowPerformingTableLabels.length > 0 && (
                <ImpactRow
                  icon="📉"
                  label="Low-check tables (no upsell)"
                  value={data.revenueIntelligence.lowPerformingTableLabels.join(
                    ", "
                  )}
                  hint="Denis nije uspešno upsell-ovao"
                />
              )}
            </div>
          </QrCard>

          <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
            <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Denis impact
            </p>
            <div className="mt-2">
              <ImpactRow
                icon="⏱️"
                label="Avg order time"
                value={formatOrderDuration(data.sessions.avgOrderTimeSeconds)}
                hint="From session open to first order"
              />
              <ImpactRow
                icon="📈"
                label="ROI"
                value={formatRoiRatio(data.cost.roi)}
                hint="Upsell revenue ÷ AI cost"
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
