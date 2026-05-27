"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, ChevronDown } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { QrCard } from "@/components/design-system/qr-card";
import { useAiInsights } from "@/hooks/use-ai-insights";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function guestLabel(count: number) {
  return count === 1 ? "1 Gast" : `${count} Gäste`;
}

function DenisStripExpanded({
  menuGaps,
  topProducts,
  alerts,
}: {
  menuGaps: Array<{ term: string; count: number }>;
  topProducts: Array<{ productId: string; name: string; count: number }>;
  alerts: Array<{ label: string; detail: string; severity: "info" | "warning" | "critical" }>;
}) {
  return (
    <div className="max-h-60 space-y-4 overflow-y-auto border-t border-dash-border px-3 py-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Menu gaps
        </p>
        {menuGaps.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">Keine Lücken erkannt.</p>
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
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Top Denis-Verkäufe
        </p>
        {topProducts.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">Noch keine Denis-Conversions.</p>
        ) : (
          <ol className="space-y-1.5">
            {topProducts.map((product, index) => (
              <li key={product.productId} className="text-sm text-dash-text-secondary">
                {index + 1}. {product.name}{" "}
                <span className="text-dash-text-disabled">({product.count}x)</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Hinweise
        </p>
        {alerts.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">Alles im grünen Bereich.</p>
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
      </div>
    </div>
  );
}

export function OverviewDenisStrip() {
  const { aiConciergeEnabled } = useDashboard();
  const [expanded, setExpanded] = useState(false);
  const { data, loading, error } = useAiInsights("today");

  if (!aiConciergeEnabled) return null;

  if (loading && !data) {
    return <Skeleton className="h-12 rounded-xl bg-dash-surface-raised" />;
  }

  if (error || !data?.enabled) return null;

  const { summary, menuGaps, topProducts, alerts } = data;
  const conversionPct = Math.round(summary.conversionRate * 100);
  const guestCount = summary.sessionCount;

  return (
    <QrCard as="section" variant="muted" padding="none">
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-dash-surface-raised/50"
        >
          <Brain className="size-4 shrink-0 text-[var(--qr-ember)]" />
          <span className="shrink-0 text-sm font-semibold text-dash-text">Denis</span>
          <span className="hidden truncate text-xs text-dash-text-muted sm:inline">
            {guestLabel(guestCount)}
          </span>
          <span className="truncate text-xs font-semibold tabular-nums text-[var(--qr-ember)]">
            {conversionPct}% Konversion
          </span>
          <ChevronDown
            className={cn(
              "ms-auto size-4 shrink-0 text-dash-text-disabled transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>
        <Link
          href="/dashboard/denis"
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-[var(--qr-ember)] transition hover:bg-[var(--qr-ember-muted)] hover:text-[var(--qr-ember-hover)]"
        >
          Details →
        </Link>
      </div>

      {expanded ? (
        <DenisStripExpanded
          menuGaps={menuGaps}
          topProducts={topProducts}
          alerts={alerts}
        />
      ) : null}
    </QrCard>
  );
}
