"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, TrendingUp, Users } from "lucide-react";
import { readApiErrorMessage } from "@/lib/api-error-client";
import { QrCard } from "@/components/design-system/qr-card";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { CrossLocationAnalytics } from "@/lib/org/cross-location-analytics";
import type { OrgHubData } from "@/lib/org/org-hub";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type HubPayload = {
  hub: OrgHubData;
  crossLocation: CrossLocationAnalytics;
};

export function OrgHubView() {
  const { currency } = useDashboard();
  const [payload, setPayload] = useState<HubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareLeft, setCompareLeft] = useState<string>("");
  const [compareRight, setCompareRight] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ days: "30" });
    if (compareLeft && compareRight) {
      params.set("left", compareLeft);
      params.set("right", compareRight);
    }

    try {
      const res = await fetch(`/api/dashboard/org-hub?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(readApiErrorMessage(json, res.status, "Could not load org hub."));
        setPayload(null);
        return;
      }
      const data = json.data as HubPayload;
      setPayload(data);
      if (!compareLeft && data.hub.locations[0]) {
        setCompareLeft(data.hub.locations[0].locationId);
      }
      if (!compareRight && data.hub.locations[1]) {
        setCompareRight(data.hub.locations[1].locationId);
      }
    } catch {
      setError("Could not load org hub.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [compareLeft, compareRight]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hub = payload?.hub;
  const cross = payload?.crossLocation;

  const comparisonLabel = useMemo(() => {
    if (!hub?.comparison) return null;
    const { leftName, rightName, revenueDelta, conversionDelta, qualityDelta } =
      hub.comparison;
    return {
      title: `${leftName} vs ${rightName}`,
      revenueDelta,
      conversionDelta,
      qualityDelta,
    };
  }, [hub?.comparison]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text-primary sm:text-2xl">
            Organization Hub
          </h1>
          <p className="mt-1 text-sm text-dash-text-secondary">
            All locations — revenue, Denis performance, and staff at a glance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/locations">Manage locations</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/billing">Billing</Link>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {hub && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QrCard className="p-4">
              <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
                Total revenue ({hub.periodDays}d)
              </p>
              <p className="mt-1 text-2xl font-bold text-dash-text-primary">
                {formatPrice(hub.totals.revenue, currency)}
              </p>
            </QrCard>
            <QrCard className="p-4">
              <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
                Orders
              </p>
              <p className="mt-1 text-2xl font-bold text-dash-text-primary">
                {hub.totals.orders}
              </p>
            </QrCard>
            <QrCard className="p-4">
              <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
                Staff
              </p>
              <p className="mt-1 text-2xl font-bold text-dash-text-primary">
                {hub.totals.staff}
              </p>
            </QrCard>
            <QrCard className="p-4">
              <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
                Avg Denis quality
              </p>
              <p className="mt-1 text-2xl font-bold text-dash-text-primary">
                {hub.totals.avgQualityScore ?? "—"}
              </p>
            </QrCard>
          </div>

          {hub.locations.length >= 2 && (
            <QrCard className="p-4">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-sm font-semibold text-dash-text-primary">
                    Side-by-side comparison
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    Compare two venues (e.g. Berlin vs Hamburg)
                  </p>
                </div>
                <select
                  value={compareLeft}
                  onChange={(e) => setCompareLeft(e.target.value)}
                  className="rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-sm"
                >
                  {hub.locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationName}
                    </option>
                  ))}
                </select>
                <span className="text-dash-text-muted">vs</span>
                <select
                  value={compareRight}
                  onChange={(e) => setCompareRight(e.target.value)}
                  className="rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-sm"
                >
                  {hub.locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationName}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Compare
                </Button>
              </div>
              {comparisonLabel && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-dash-surface-raised p-3">
                    <p className="text-xs text-dash-text-muted">Revenue delta</p>
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        comparisonLabel.revenueDelta >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      )}
                    >
                      {comparisonLabel.revenueDelta >= 0 ? "+" : ""}
                      {formatPrice(comparisonLabel.revenueDelta, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-dash-surface-raised p-3">
                    <p className="text-xs text-dash-text-muted">Conversion delta</p>
                    <p className="text-lg font-semibold text-dash-text-primary">
                      {(comparisonLabel.conversionDelta * 100).toFixed(1)} pp
                    </p>
                  </div>
                  <div className="rounded-lg bg-dash-surface-raised p-3">
                    <p className="text-xs text-dash-text-muted">Quality delta</p>
                    <p className="text-lg font-semibold text-dash-text-primary">
                      {comparisonLabel.qualityDelta != null
                        ? `${comparisonLabel.qualityDelta >= 0 ? "+" : ""}${comparisonLabel.qualityDelta}`
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </QrCard>
          )}

          <QrCard className="overflow-hidden">
            <div className="border-b border-dash-border-subtle px-4 py-3">
              <h2 className="font-semibold text-dash-text-primary">Locations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-dash-border-subtle text-left text-xs uppercase tracking-wider text-dash-text-disabled">
                    <th className="px-4 py-3">Venue</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Denis conv.</th>
                    <th className="px-4 py-3">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {hub.locations.map((loc) => (
                    <tr
                      key={loc.locationId}
                      className="border-b border-dash-border-subtle/60 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-dash-accent" />
                          <div>
                            <p className="font-medium text-dash-text-primary">
                              {loc.locationName}
                            </p>
                            {loc.city && (
                              <p className="text-xs text-dash-text-muted">{loc.city}</p>
                            )}
                          </div>
                          {!loc.isActive && (
                            <span className="rounded bg-dash-surface-raised px-1.5 py-0.5 text-[10px] uppercase text-dash-text-muted">
                              inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-dash-text-secondary">
                        {formatPrice(loc.revenue30d, currency)}
                      </td>
                      <td className="px-4 py-3">{loc.orderCount30d}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {loc.staffCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(loc.denisConversionRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3">
                        {loc.denisQualityScore ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QrCard>

          {cross && cross.topMenuItems.length > 0 && (
            <QrCard className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="size-4 text-dash-accent" />
                <h2 className="font-semibold text-dash-text-primary">
                  Top menu items by location
                </h2>
              </div>
              <ul className="space-y-2 text-sm">
                {cross.topMenuItems.slice(0, 8).map((item, i) => (
                  <li
                    key={`${item.locationId}-${item.productName}-${i}`}
                    className="flex justify-between gap-4 border-b border-dash-border-subtle/50 pb-2 last:border-0"
                  >
                    <span className="text-dash-text-secondary">
                      {item.productName}{" "}
                      <span className="text-dash-text-muted">@ {item.locationName}</span>
                    </span>
                    <span className="shrink-0 font-medium text-dash-text-primary">
                      {formatPrice(item.revenue, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </QrCard>
          )}

          {cross && cross.staffPerformance.length > 0 && (
            <QrCard className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="size-4 text-dash-accent" />
                <h2 className="font-semibold text-dash-text-primary">
                  Staff performance across locations
                </h2>
              </div>
              <ul className="space-y-2 text-sm">
                {cross.staffPerformance.slice(0, 6).map((row, i) => (
                  <li
                    key={`${row.staffId}-${row.locationId}-${i}`}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-dash-text-secondary">
                      {row.staffName}{" "}
                      <span className="text-dash-text-muted">@ {row.locationName}</span>
                    </span>
                    <span className="text-dash-text-primary">
                      {row.ordersHandled} orders · {formatPrice(row.revenue, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </QrCard>
          )}
        </>
      )}
    </div>
  );
}
