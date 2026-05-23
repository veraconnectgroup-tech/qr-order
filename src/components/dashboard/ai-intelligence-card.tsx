"use client";

import { Brain, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
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

export function AiIntelligenceCard({ className }: { className?: string }) {
  const { currency } = useDashboard();
  const { data, loading, error, range, setRange } = useAiInsights("today");

  if (loading && !data) {
    return (
      <Skeleton className={cn("h-[360px] rounded-xl bg-zinc-800", className)} />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm text-zinc-400">{error}</p>
      </div>
    );
  }

  if (!data?.enabled) return null;

  const {
    summary,
    menuGaps,
    topProducts,
    alerts,
  } = data;
  const conversionPct = Math.round(summary.conversionRate * 100);

  return (
    <section className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-zinc-100">AI Intelligence</h3>
        </div>
        <label className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as AiInsightsRange)}
            className="appearance-none rounded-lg border border-zinc-700 bg-zinc-950 py-1.5 pe-8 ps-3 text-xs font-medium text-zinc-200 outline-none focus:border-orange-500/50"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-zinc-500">AI-Umsatz</p>
          <p className="mt-1 text-base font-bold tabular-nums text-zinc-50">
            {formatPrice(summary.aiRevenue, currency)}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Konversion</p>
          <p className="mt-1 text-base font-bold tabular-nums text-orange-400">
            {conversionPct}%
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Empfehlungen</p>
          <p className="mt-1 text-base font-bold tabular-nums text-zinc-50">
            {summary.addedCount}/{summary.recommendedCount} hinzugefügt
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Bewertung</p>
          <p className="mt-1 text-base font-bold tabular-nums text-zinc-50">
            {summary.averageRating != null
              ? `${summary.averageRating.toFixed(1)}★`
              : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            🚨 Menu Gaps
          </p>
          {menuGaps.length === 0 ? (
            <p className="text-sm text-zinc-500">Keine Lücken erkannt.</p>
          ) : (
            <ul className="space-y-1.5">
              {menuGaps.map((gap) => (
                <li
                  key={gap.term}
                  className="text-sm text-zinc-300 before:me-2 before:text-zinc-600 before:content-['•']"
                >
                  &quot;{gap.term}&quot; — {guestLabel(gap.count)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            📊 Top AI-Verkäufe
          </p>
          {topProducts.length === 0 ? (
            <p className="text-sm text-zinc-500">Noch keine AI-Conversions.</p>
          ) : (
            <ol className="space-y-1.5">
              {topProducts.map((product, index) => (
                <li
                  key={product.productId}
                  className="text-sm text-zinc-300"
                >
                  {index + 1}. {product.name}{" "}
                  <span className="text-zinc-500">({product.count}x)</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            ⚠️ Hinweise
          </p>
          {alerts.length === 0 ? (
            <p className="text-sm text-zinc-500">Alles im grünen Bereich.</p>
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
                        : "text-zinc-300 before:text-zinc-600"
                  )}
                >
                  {alert.label}: {alert.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
