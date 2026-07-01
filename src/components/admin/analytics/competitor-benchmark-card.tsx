"use client";

import { ChartCard } from "@/components/admin/analytics/chart-card";
import type { CompetitorBenchmarkSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-sm font-semibold tabular-nums",
        positive ? "text-emerald-600" : "text-red-500"
      )}
    >
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

export function CompetitorBenchmarkCard({
  data,
  currency,
  className,
}: {
  data: CompetitorBenchmarkSnapshot;
  currency: string;
  className?: string;
}) {
  return (
    <ChartCard
      title="Industry benchmark"
      description="Your venue vs EU casual-dining QR ordering averages"
      className={className}
    >
      <p className="mb-4 text-sm text-muted-foreground">{data.summary}</p>

      <div className="space-y-4">
        <BenchmarkRow
          label="Average ticket"
          industry={formatPrice(data.industryAvgTicket, currency)}
          venue={formatPrice(data.venueAvgTicket, currency)}
          delta={data.ticketDeltaPct}
        />
        <BenchmarkRow
          label="Conversion rate"
          industry={`${(data.industryConversionRate * 100).toFixed(1)}%`}
          venue={`${(data.venueConversionRate * 100).toFixed(1)}%`}
          delta={data.conversionDeltaPct}
        />
        <BenchmarkRow
          label="Cart abandonment"
          industry={`${data.industryCartAbandonmentRate.toFixed(1)}%`}
          venue={`${data.venueCartAbandonmentRate.toFixed(1)}%`}
          delta={
            data.venueCartAbandonmentRate - data.industryCartAbandonmentRate
          }
          invertDelta
        />
      </div>
    </ChartCard>
  );
}

function BenchmarkRow({
  label,
  industry,
  venue,
  delta,
  invertDelta = false,
}: {
  label: string;
  industry: string;
  venue: string;
  delta: number;
  invertDelta?: boolean;
}) {
  const displayDelta = invertDelta ? -delta : delta;

  return (
    <div className="rounded-lg border border-border/60 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {venue}
          </p>
          <p className="text-xs text-muted-foreground">Industry {industry}</p>
        </div>
        <Delta value={Math.round(displayDelta * 10) / 10} />
      </div>
    </div>
  );
}
