"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  DenisPanel,
  DenisPanelBody,
  DenisPanelFooter,
  DenisPanelHeader,
} from "@/components/design-system/denis-panel";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import {
  DenisMessageBlock,
  DenisThreadLabel,
} from "@/components/design-system/denis-message-block";
import {
  DenisStaffTableBrief,
} from "@/components/dashboard/denis-staff-copilot-parts";
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

/** DE-07 — right drawer with DenisPanel gramat for floor copilot. */
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
        className="w-full gap-0 border-dash-border bg-[var(--qr-void)] p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b border-dash-border px-4 py-3 text-left">
          <SheetTitle className="sr-only">Denis staff copilot</SheetTitle>
          <SheetDescription className="sr-only">
            Floor priorities and table hints
          </SheetDescription>
          <div className="flex items-center justify-between gap-2 pe-8">
            <div className="flex items-center gap-2">
              <DenisTableMark size={24} state="idle" />
              <span className="text-sm font-semibold text-[var(--qr-ivory)]">
                Denis
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => void refresh()}
              className="min-h-10 gap-1.5 text-[var(--qr-muted)] hover:text-[var(--qr-ivory)]"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading && !data ? (
            <Skeleton className="m-4 h-40 rounded-xl bg-dash-surface-raised" />
          ) : error ? (
            <p className="p-4 text-sm text-dash-text-muted">{error}</p>
          ) : !data?.enabled ? (
            <p className="p-4 text-sm text-dash-text-muted">
              Denis is not enabled for this location.
            </p>
          ) : (
            <DenisPanel className="mx-3 my-3 max-h-none min-h-0 flex-1 rounded-xl border border-[var(--qr-elevated)]">
              <DenisPanelHeader className="border-b border-[var(--qr-elevated)] px-4 py-3 sm:px-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--qr-muted)]">
                  House status
                </p>
                <p className="mt-1 text-sm text-[var(--qr-ivory)]">
                  {data.activeOrderCount} active orders ·{" "}
                  <span className="capitalize">
                    {data.operatingMode.replace("_", " ")}
                  </span>
                  {data.kdsBacklogMinutes != null
                    ? ` · KDS ${data.kdsBacklogMinutes} min`
                    : ""}
                </p>
              </DenisPanelHeader>

              <DenisPanelBody className="px-4 py-3 sm:px-4">
                {data.priorityTables.length === 0 ? (
                  <DenisMessageBlock role="assistant">
                    <DenisThreadLabel />
                    <p className="text-sm leading-relaxed text-[var(--qr-ivory)]">
                      No tables need attention right now. Floor looks clear.
                    </p>
                  </DenisMessageBlock>
                ) : (
                  <div className="space-y-3">
                    {data.priorityTables.slice(0, 6).map((table) => (
                      <DenisStaffTableBrief key={table.tableId} table={table} />
                    ))}
                  </div>
                )}
              </DenisPanelBody>

              <DenisPanelFooter className="border-t border-[var(--qr-elevated)] px-4 py-3 sm:px-4">
                <Button
                  asChild
                  variant="outline"
                  className="min-h-12 w-full border-[var(--qr-elevated)] bg-transparent text-[var(--qr-ivory)] hover:bg-[var(--qr-surface)]"
                >
                  <Link href="/dashboard/denis" onClick={() => onOpenChange(false)}>
                    Open full copilot →
                  </Link>
                </Button>
              </DenisPanelFooter>
            </DenisPanel>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
