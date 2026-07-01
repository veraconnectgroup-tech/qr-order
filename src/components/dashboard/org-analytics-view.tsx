"use client";

import { readApiErrorMessage } from "@/lib/api-error-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { QrCard } from "@/components/design-system/qr-card";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { OrgAnalyticsData } from "@/lib/dashboard/org-analytics";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortKey = "locationName" | "sessions" | "conversionRate" | "revenue" | "aiCost";

function OrgAnalyticsSortHeader({
  label,
  column,
  className,
  sortKey,
  sortAsc,
  onToggle,
}: {
  label: string;
  column: SortKey;
  className?: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-dash-text-disabled hover:text-dash-text-secondary",
        className
      )}
    >
      {label}
      {active &&
        (sortAsc ? (
          <ArrowUp className="size-3" aria-hidden />
        ) : (
          <ArrowDown className="size-3" aria-hidden />
        ))}
    </button>
  );
}

export function OrgAnalyticsView() {
  const { currency } = useDashboard();
  const [data, setData] = useState<OrgAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortAsc, setSortAsc] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/org-analytics?range=30d");
      const json = await res.json();
      if (!res.ok) {
        setError(readApiErrorMessage(json, res.status, "Could not load org analytics."));
        setData(null);
        return;
      }
      setData(json.data as OrgAnalyticsData);
    } catch {
      setError("Could not load org analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedLocations = useMemo(() => {
    if (!data) return [];
    const rows = [...data.locations];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return rows;
  }, [data, sortAsc, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((value) => !value);
      return;
    }
    setSortKey(key);
    setSortAsc(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text-primary sm:text-2xl">
            Org Analytics
          </h1>
          <p className="mt-1 text-sm text-dash-text-secondary">
            Cross-location Denis performance for your group
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/dashboard/org-analytics?range=30d&format=csv">
            <Download className="mr-2 size-4" aria-hidden />
            Export CSV
          </a>
        </Button>
      </div>

      {error && (
        <QrCard className="border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </QrCard>
      )}

      {loading && !data ? (
        <Skeleton className="h-64 rounded-xl bg-dash-surface" />
      ) : data ? (
        <>
          <QrCard className="overflow-x-auto border-dash-border-subtle bg-dash-surface-raised p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border-subtle">
                  <th className="px-4 py-3 text-left">
                    <OrgAnalyticsSortHeader
                      label="Location"
                      column="locationName"
                      sortKey={sortKey}
                      sortAsc={sortAsc}
                      onToggle={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <OrgAnalyticsSortHeader
                      label="Sessions"
                      column="sessions"
                      className="justify-end"
                      sortKey={sortKey}
                      sortAsc={sortAsc}
                      onToggle={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <OrgAnalyticsSortHeader
                      label="Conv %"
                      column="conversionRate"
                      className="justify-end"
                      sortKey={sortKey}
                      sortAsc={sortAsc}
                      onToggle={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <OrgAnalyticsSortHeader
                      label="Revenue"
                      column="revenue"
                      className="justify-end"
                      sortKey={sortKey}
                      sortAsc={sortAsc}
                      onToggle={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <OrgAnalyticsSortHeader
                      label="AI Cost"
                      column="aiCost"
                      className="justify-end"
                      sortKey={sortKey}
                      sortAsc={sortAsc}
                      onToggle={toggleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLocations.map((row) => (
                  <tr
                    key={row.locationId}
                    className="border-b border-dash-border-subtle/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-dash-text-primary">{row.locationName}</td>
                    <td className="px-4 py-3 text-right font-mono text-dash-text-secondary">
                      {row.sessions}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-dash-text-secondary">
                      {(row.conversionRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-dash-text-secondary">
                      {formatPrice(row.revenue, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-dash-text-secondary">
                      {formatPrice(row.aiCost, currency)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-dash-surface font-semibold">
                  <td className="px-4 py-3 text-dash-text-primary">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono">{data.totals.sessions}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(data.totals.conversionRate * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPrice(data.totals.revenue, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPrice(data.totals.aiCost, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </QrCard>

          {data.insights.length > 0 && (
            <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
              <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                Insights
              </p>
              <ul className="mt-3 space-y-2 text-sm text-dash-text-secondary">
                {data.insights.map((insight, index) => (
                  <li key={index}>
                    <p>{insight.message}</p>
                    {insight.suggestion && (
                      <p className="mt-1 text-dash-accent">💡 {insight.suggestion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </QrCard>
          )}
        </>
      ) : null}
    </div>
  );
}
