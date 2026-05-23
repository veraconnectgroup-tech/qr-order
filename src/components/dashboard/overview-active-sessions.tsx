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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Active sessions</h3>
        <Link
          href="/dashboard/tables"
          className="text-xs font-medium text-orange-400 hover:text-orange-300"
        >
          Floor plan →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="size-3 rounded-full bg-zinc-800" />
          ))}
        </div>
      ) : !tables.length ? (
        <p className="py-4 text-center text-sm text-zinc-500">
          No tables configured
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">{activeCount}</span>{" "}
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
