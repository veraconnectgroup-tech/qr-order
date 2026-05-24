"use client";

import Link from "next/link";
import type { OverviewTableStatus } from "@/lib/dashboard/overview-types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function OverviewActiveSessions({
  tables,
  loading,
}: {
  tables: OverviewTableStatus[];
  loading?: boolean;
}) {
  const activeCount = tables.filter((t) => t.status !== "available").length;

  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dash-text-secondary">Active sessions</h3>
        <Link
          href="/dashboard/tables"
          className="text-xs font-medium text-dash-accent hover:text-dash-accent"
        >
          Floor plan →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="size-3 rounded-full bg-dash-surface-raised" />
          ))}
        </div>
      ) : !tables.length ? (
        <p className="py-4 text-center text-sm text-dash-text-disabled">
          No tables configured
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-dash-text-muted">
            <span className="font-semibold text-dash-text-secondary">{activeCount}</span>{" "}
            {activeCount === 1 ? "table" : "tables"} active
          </p>
          <div className="flex flex-wrap gap-2">
            {tables.map((table) => (
              <Link
                key={table.id}
                href="/dashboard/tables"
                title={table.name}
                className={cn(
                  "size-3 rounded-full transition hover:scale-125",
                  table.status === "available" ? "bg-zinc-600" : "bg-emerald-400"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
