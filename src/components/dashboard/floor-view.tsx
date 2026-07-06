"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  FloorTableDetailSheet,
  FloorViewLegend,
} from "@/components/dashboard/floor-table-detail-sheet";
import {
  floorViewStatusColor,
  floorViewStatusLabel,
  type FloorTableRow,
} from "@/lib/dashboard/floor-status";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function groupTablesByZone(tables: FloorTableRow[]) {
  const hasZones = tables.some((table) => table.zoneId);
  if (!hasZones) {
    return [{ zoneId: "all", zoneName: "Floor", tables }];
  }

  const groups = new Map<
    string,
    { zoneName: string; tables: FloorTableRow[] }
  >();

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

function FloorTile({
  table,
  currency,
  selected,
  onSelect,
}: {
  table: FloorTableRow;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = floorViewStatusColor[table.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border bg-dash-surface p-2 text-center transition sm:p-3",
        "hover:border-dash-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qr-ember)]",
        colors.border,
        selected && "ring-2 ring-[var(--qr-ember)]"
      )}
    >
      <p className="text-sm font-semibold text-dash-text">{table.name}</p>
      <p className={cn("mt-1 text-[11px] font-medium", colors.text)}>
        <span
          className={cn("me-1 inline-block size-1.5 rounded-full", colors.dot)}
        />
        {floorViewStatusLabel[table.status]}
      </p>
      {table.sessionTotal != null && table.sessionTotal > 0 ? (
        <p className="mt-1 font-mono text-xs text-[var(--qr-ember)]">
          {formatPrice(table.sessionTotal, currency)}
        </p>
      ) : null}
    </button>
  );
}

export function FloorView({
  tables,
  loading,
  currency,
}: {
  tables: FloorTableRow[];
  loading?: boolean;
  currency: string;
}) {
  const [selected, setSelected] = useState<FloorTableRow | null>(null);
  const groups = useMemo(() => groupTablesByZone(tables), [tables]);

  const statusCounts = useMemo(() => {
    const counts = { free: 0, ordering: 0, waiting: 0, problem: 0 };
    for (const table of tables) counts[table.status] += 1;
    return counts;
  }, [tables]);

  return (
    <div className="flex h-full flex-col">
      <div className="overview-v3-floor-meta shrink-0">
        <div className="overview-v3-floor-stats">
          <span className="overview-v3-floor-stat">{statusCounts.free} free</span>
          <span className="overview-v3-floor-stat">
            {statusCounts.ordering} ordering
          </span>
          <span className="overview-v3-floor-stat">
            {statusCounts.waiting} waiting
          </span>
          <span className="overview-v3-floor-stat">
            {statusCounts.problem} problem
          </span>
        </div>
        <FloorViewLegend />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-20 rounded-xl bg-dash-surface-raised"
              />
            ))}
          </div>
        ) : !tables.length ? (
          <p className="py-6 text-center text-sm text-dash-text-disabled">
            No tables configured
          </p>
        ) : (
          <div className="space-y-5 pb-1">
            {groups.map((group) => (
              <section key={group.zoneId}>
                {groups.length > 1 ? (
                  <h4 className="overview-v3-zone-label mb-2">
                    {group.zoneName}
                  </h4>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
                  {group.tables.map((table) => (
                    <FloorTile
                      key={table.id}
                      table={table}
                      currency={currency}
                      selected={selected?.id === table.id}
                      onSelect={() => setSelected(table)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected ? (
          <FloorTableDetailSheet
            key={selected.id}
            table={selected}
            currency={currency}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
