"use client";

import { AlertTriangle } from "lucide-react";
import { FloorTile } from "@/components/design-system";
import { HintBadge } from "@/components/dashboard/denis-staff-copilot-parts";
import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
import type { DashboardFloorGraphPayload } from "@/lib/denis/venue/floor/load-dashboard-floor-graph";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function stationStressStyles(stress: string) {
  if (stress === "high" || stress === "overloaded" || stress === "busy") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  return "border-dash-border bg-dash-surface-raised text-dash-text-muted";
}

function modeLabel(mode: string) {
  return mode.replace("_", " ");
}

export function FloorGraphLiveMap({
  data,
  loading,
  error,
}: {
  data: DashboardFloorGraphPayload | null;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading && !data) {
    return (
      <Skeleton className="h-48 w-full rounded-xl bg-dash-surface-raised" />
    );
  }

  if (error) {
    return (
      <QrCard variant="muted" padding="md">
        <p className="text-sm text-dash-text-muted">{error}</p>
      </QrCard>
    );
  }

  if (!data?.enabled || !data.floor) {
    return (
      <QrCard variant="muted" padding="md">
        <p className="text-sm text-dash-text-muted">
          Floor graph is not enabled for this location.
        </p>
      </QrCard>
    );
  }

  const { floor, tables, stationStress, autoRushWouldApply } = data;
  const activeTables = tables.filter((table) => table.hasActiveSession);

  return (
    <QrCard variant="muted" padding="md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <QrCardHeading>Floor graph</QrCardHeading>
          <p className="mt-1 text-xs text-dash-text-disabled">
            Live table hints · station stress · house mode
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-dash-border bg-dash-bg px-2 py-1 capitalize text-dash-text-secondary">
            {modeLabel(floor.house.operatingMode)}
          </span>
          <span
            className={cn(
              "rounded-md border px-2 py-1 tabular-nums",
              (floor.house.kdsBacklogMinutes ?? 0) >= 20
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-dash-border bg-dash-bg text-dash-text-secondary"
            )}
          >
            KDS {floor.house.kdsBacklogMinutes ?? "—"} min
          </span>
          <span className="rounded-md border border-dash-border bg-dash-bg px-2 py-1 tabular-nums text-dash-text-secondary">
            Staff {floor.house.staffOnFloor ?? "—"}
          </span>
        </div>
      </div>

      {autoRushWouldApply ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <AlertTriangle className="size-4 shrink-0" />
          Auto-rush threshold reached — Denis shortens replies and skips dessert
          nudges.
        </p>
      ) : null}

      {floor.house.houseHint ? (
        <p className="mb-4 text-sm text-amber-200">{floor.house.houseHint}</p>
      ) : null}

      {stationStress.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {stationStress.map((row) => (
            <span
              key={row.station}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                stationStressStyles(row.stress)
              )}
            >
              {row.station}{" "}
              {row.avgWaitMinutes != null ? `${row.avgWaitMinutes}m` : "—"} ·{" "}
              {row.stress}
            </span>
          ))}
        </div>
      ) : null}

      {activeTables.length === 0 ? (
        <p className="py-8 text-center text-sm text-dash-text-disabled">
          No active table sessions on the floor.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {activeTables.map((table) => (
            <FloorTile
              key={table.tableId}
              variant="floor"
              status={table.operatingHint === "needs_attention" ? "payment" : "occupied"}
              label={table.tableName}
              className="p-2 text-center sm:p-3"
            >
              <div className="mt-2 space-y-1">
                {table.seatedMinutes != null ? (
                  <p className="text-[11px] tabular-nums text-dash-text-muted">
                    {table.seatedMinutes} min seated
                  </p>
                ) : null}
                {table.openOrderCount > 0 ? (
                  <p className="text-[11px] tabular-nums text-dash-text-secondary">
                    {table.openOrderCount} open
                  </p>
                ) : null}
                <div className="flex justify-center">
                  <HintBadge hint={table.operatingHint} />
                </div>
              </div>
            </FloorTile>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-dash-text-disabled">
        Updated {new Date(data.at).toLocaleTimeString()} · refreshes every 30s
      </p>
    </QrCard>
  );
}
