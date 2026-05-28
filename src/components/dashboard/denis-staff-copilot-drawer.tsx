"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { DenisStaffTableBrief } from "@/components/dashboard/denis-staff-copilot-parts";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDenisStaffCopilot } from "@/hooks/use-denis-staff-copilot";
import { cn } from "@/lib/utils";

/** Right drawer — floor priorities at a glance (overview quick open). */
export function DenisStaffCopilotDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, loading, error, refresh } = useDenisStaffCopilot();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="dashboard-theme w-full gap-0 border-dash-border bg-dash-bg p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="space-y-0 border-b border-dash-border px-4 py-4 text-left">
          <SheetTitle className="sr-only">Denis floor copilot</SheetTitle>
          <SheetDescription className="sr-only">
            Priority tables and house status
          </SheetDescription>
          <div className="flex items-start justify-between gap-3 pe-8">
            <div className="flex min-w-0 items-start gap-3">
              <DenisMarkBadge
                size="md"
                className="mt-0.5 bg-dash-accent-muted ring-dash-border-subtle"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dash-text">Denis</p>
                <p className="mt-0.5 text-xs text-dash-text-muted">
                  Floor priorities & table hints
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void refresh()}
              className="min-h-10 shrink-0 gap-1.5 border-dash-border bg-dash-surface text-dash-text-secondary hover:bg-dash-surface-raised hover:text-dash-text"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && !data ? (
            <Skeleton className="h-40 rounded-xl bg-dash-surface-raised" />
          ) : error ? (
            <p className="text-sm text-dash-text-muted">{error}</p>
          ) : !data?.enabled ? (
            <p className="text-sm text-dash-text-muted">
              Denis is not enabled for this location.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-dash-border bg-dash-surface/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                  House status
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-dash-text-muted">Active orders</p>
                    <p className="mt-1 font-bold tabular-nums text-dash-text">
                      {data.activeOrderCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dash-text-muted">KDS backlog</p>
                    <p className="mt-1 font-bold tabular-nums text-dash-text">
                      {data.kdsBacklogMinutes != null
                        ? `${data.kdsBacklogMinutes} min`
                        : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-dash-text-muted">Operating mode</p>
                    <p className="mt-1 font-semibold capitalize text-dash-text-secondary">
                      {data.operatingMode.replace("_", " ")} · KDS {data.kdsStress}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                  Priority tables
                </p>
                {data.priorityTables.length === 0 ? (
                  <p className="rounded-xl border border-dash-border bg-dash-surface/80 px-4 py-6 text-center text-sm text-dash-text-muted">
                    No tables need attention right now.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.priorityTables.slice(0, 8).map((table) => (
                      <DenisStaffTableBrief key={table.tableId} table={table} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-dash-border p-4">
          <Button
            asChild
            className="min-h-12 w-full bg-dash-accent text-white hover:bg-dash-accent-hover"
          >
            <Link href="/dashboard/denis" onClick={() => onOpenChange(false)}>
              Open full Denis →
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
