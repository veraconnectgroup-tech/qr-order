"use client";

import Link from "next/link";
import { FloorTile } from "@/components/design-system";
import { QrCard, QrCardHeading } from "@/components/design-system/qr-card";
import type { FloorTileStatus } from "@/components/design-system/floor-tile.types";
import type { OverviewTableStatus } from "@/lib/dashboard/overview-types";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MAX_TILES_PER_ZONE = 6;

function overviewStatusToFloorStatus(
  status: OverviewTableStatus["status"]
): FloorTileStatus {
  if (status === "payment") return "payment";
  if (status === "occupied") return "occupied";
  return "available";
}

function groupTablesByZone(tables: OverviewTableStatus[]) {
  const hasZones = tables.some((table) => table.zoneId);
  if (!hasZones) {
    return [{ zoneId: "all", zoneName: "Floor", tables }];
  }

  const groups = new Map<string, { zoneName: string; tables: OverviewTableStatus[] }>();

  for (const table of tables) {
    const zoneId = table.zoneId ?? "unassigned";
    const zoneName = table.zoneName ?? "Unassigned";
    const group = groups.get(zoneId) ?? { zoneName, tables: [] };
    group.tables.push(table);
    groups.set(zoneId, group);
  }

  return Array.from(groups.entries()).map(([zoneId, group]) => ({
    zoneId,
    zoneName: group.zoneName,
    tables: group.tables,
  }));
}

function FloorSnapshotTile({
  table,
  currency,
}: {
  table: OverviewTableStatus;
  currency: string;
}) {
  const status = overviewStatusToFloorStatus(table.status);
  const isActive = table.status !== "available";

  return (
    <FloorTile
      as="a"
      href="/dashboard/tables"
      variant="floor"
      status={status}
      label={table.name}
      className={cn(
        "block p-2 text-center sm:p-3",
        table.status === "occupied" && "animate-pulse"
      )}
    >
      {table.status === "payment" ? (
        <p className="mt-1 text-[11px] text-amber-400">
          <span className="mr-1 inline-block size-1.5 rounded-full bg-amber-500" />
          Payment
        </p>
      ) : isActive ? (
        <>
          <p className="mt-1 text-[11px] text-emerald-400">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
            Occupied
          </p>
          {table.sessionTotal && table.sessionTotal > 0 ? (
            <p className="mt-1 font-mono text-[var(--qr-ember)]">
              {formatPrice(table.sessionTotal, currency)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-dash-text-disabled">
          Available
        </p>
      )}
    </FloorTile>
  );
}

export function OverviewFloorSnapshot({
  tables,
  loading,
  currency,
}: {
  tables: OverviewTableStatus[];
  loading?: boolean;
  currency: string;
}) {
  const groups = groupTablesByZone(tables);

  return (
    <QrCard variant="muted" padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <QrCardHeading>Floor snapshot</QrCardHeading>
        <Link
          href="/dashboard/tables"
          className="text-xs font-medium text-[var(--qr-ember)] hover:text-[var(--qr-ember-hover)]"
        >
          Full floor →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-dash-surface-raised" />
          ))}
        </div>
      ) : !tables.length ? (
        <p className="py-6 text-center text-sm text-dash-text-disabled">
          No tables configured
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const visible = group.tables.slice(0, MAX_TILES_PER_ZONE);
            const hiddenCount = group.tables.length - visible.length;

            return (
              <section key={group.zoneId}>
                {groups.length > 1 ? (
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                      {group.zoneName}
                    </h4>
                    <span className="rounded-full bg-dash-surface-raised px-2 py-0.5 text-[10px] font-semibold tabular-nums text-dash-text-muted">
                      {group.tables.length}
                    </span>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
                  {visible.map((table) => (
                    <FloorSnapshotTile
                      key={table.id}
                      table={table}
                      currency={currency}
                    />
                  ))}
                </div>
                {hiddenCount > 0 ? (
                  <Link
                    href="/dashboard/tables"
                    className="mt-2 inline-block text-xs font-medium text-[var(--qr-ember)] hover:text-[var(--qr-ember-hover)]"
                  >
                    +{hiddenCount} more in {group.zoneName} →
                  </Link>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </QrCard>
  );
}
