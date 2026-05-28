"use client";

import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
import { useAiInsights } from "@/hooks/use-ai-insights";
import { formatPrice } from "@/lib/format";
import type { AiInsightsRange } from "@/lib/dashboard/ai-insights-data";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{ value: AiInsightsRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
];

function guestLabel(count: number) {
  return count === 1 ? "1 Gast" : `${count} Gäste`;
}

function InsightSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
        {title}
      </p>
      {children}
    </div>
  );
}

export function AiIntelligenceCard({ className }: { className?: string }) {
  const { currency } = useDashboard();
  const { data, loading, error, range, setRange } = useAiInsights("today");

  if (loading && !data) {
    return (
      <Skeleton
        className={cn("h-[280px] rounded-xl bg-dash-surface-raised", className)}
      />
    );
  }

  if (error) {
    return (
      <QrCard variant="muted" padding="md">
        <p className="text-sm text-dash-text-muted">{error}</p>
      </QrCard>
    );
  }

  if (!data?.enabled) return null;

  const { summary, menuGaps, topProducts, alerts } = data;
  const conversionPct = Math.round(summary.conversionRate * 100);

  return (
    <QrCard as="section" variant="muted" padding="md" className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DenisMarkBadge
            size="md"
            className="bg-dash-accent-muted ring-dash-border-subtle"
          />
          <div className="min-w-0">
            <QrCardHeading className="text-dash-text">Denis</QrCardHeading>
            <p className="text-xs text-dash-text-muted">Performance & insights</p>
          </div>
        </div>
        <label className="relative shrink-0">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as AiInsightsRange)}
            className="appearance-none rounded-lg border border-dash-surface-overlay bg-dash-bg py-1.5 pe-8 ps-3 text-xs font-medium text-dash-text-secondary outline-none focus:border-dash-accent/50"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-dash-text-disabled" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-dash-border bg-dash-bg/60 p-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-dash-text-disabled">Denis-Umsatz</p>
          <p className="mt-1 text-base font-bold tabular-nums text-dash-text">
            {formatPrice(summary.aiRevenue, currency)}
          </p>
        </div>
        <div>
          <p className="text-dash-text-disabled">Konversion</p>
          <p className="mt-1 text-base font-bold tabular-nums text-dash-accent">
            {conversionPct}%
          </p>
        </div>
        <div>
          <p className="text-dash-text-disabled">Empfehlungen</p>
          <p className="mt-1 text-base font-bold tabular-nums text-dash-text">
            {summary.addedCount}/{summary.recommendedCount} hinzugefügt
          </p>
        </div>
        <div>
          <p className="text-dash-text-disabled">Bewertung</p>
          <p className="mt-1 text-base font-bold tabular-nums text-dash-text">
            {summary.averageRating != null
              ? summary.averageRating.toFixed(1)
              : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <InsightSection title="Menu gaps">
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
        </InsightSection>

        <InsightSection title="Top Denis-Verkäufe">
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
        </InsightSection>

        <InsightSection title="Hinweise">
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
        </InsightSection>
      </div>
    </QrCard>
  );
}
