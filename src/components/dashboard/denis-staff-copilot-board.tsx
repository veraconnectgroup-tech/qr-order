"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { QrCard } from "@/components/design-system/qr-card";
import { StaffCopilotTableList } from "@/components/dashboard/denis-staff-copilot-parts";
import { useDenisStaffCopilot } from "@/hooks/use-denis-staff-copilot";
import {
  setDenisKdsStress,
  setDenisOperatingMode,
  upsertDenisStaffTableHint,
} from "@/lib/denis/venue/ops/staff-ops-actions";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ value: VenueOperatingMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "rush", label: "Rush" },
  { value: "kitchen_closed", label: "Kitchen closed" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
      {children}
    </p>
  );
}

export function DenisStaffCopilotBoard() {
  const { data, loading, error, refresh } = useDenisStaffCopilot();
  const [pending, startTransition] = useTransition();
  const [hintTableId, setHintTableId] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintVisibility, setHintVisibility] = useState<
    "denis_only" | "guest_safe"
  >("denis_only");

  const activeTables = useMemo(
    () => (data?.tables ?? []).filter((table) => table.hasActiveSession),
    [data?.tables]
  );

  if (loading && !data) {
    return <Skeleton className="h-[520px] rounded-xl bg-dash-surface-raised" />;
  }

  if (error) {
    return (
      <QrCard variant="muted" padding="md">
        <p className="text-sm text-dash-text-muted">{error}</p>
      </QrCard>
    );
  }

  if (!data?.enabled) {
    return (
      <QrCard variant="muted" padding="lg" className="text-center">
        <DenisMarkBadge
          size="lg"
          className="mx-auto bg-dash-accent-muted ring-dash-border-subtle"
        />
        <p className="mt-3 text-sm text-dash-text-muted">
          Denis is not enabled for this location. Turn on Denis in admin
          settings.
        </p>
      </QrCard>
    );
  }

  function applyMode(mode: VenueOperatingMode) {
    startTransition(async () => {
      const result = await setDenisOperatingMode(mode);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Operating mode: ${mode}`);
      await refresh();
    });
  }

  function applyKdsStress(stress: "normal" | "high") {
    startTransition(async () => {
      const result = await setDenisKdsStress(stress);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`KDS stress: ${stress}`);
      await refresh();
    });
  }

  function submitHint() {
    if (!hintTableId || !hintText.trim()) {
      toast.error("Pick a table and enter hint text.");
      return;
    }

    startTransition(async () => {
      const result = await upsertDenisStaffTableHint({
        tableId: hintTableId,
        text: hintText.trim(),
        visibility: hintVisibility,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Table hint saved for Denis.");
      setHintText("");
      await refresh();
    });
  }

  const backlogHigh =
    data.kdsBacklogMinutes != null &&
    data.kdsBacklogMinutes >= data.autoRushBacklogMinutes;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <DenisMarkBadge
            size="md"
            className="mt-0.5 bg-dash-accent-muted ring-dash-border-subtle"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
              Venue OS
            </p>
            <h2 className="mt-1 text-xl font-bold text-dash-text sm:text-2xl">
              Floor & ops
            </h2>
            <p className="mt-1 text-sm text-dash-text-muted">
              Priorities, rush mode, and table hints.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void refresh()}
          className="min-h-12 gap-2"
        >
          <RefreshCw className={cn("size-4", pending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <QrCard variant="muted" padding="md" className="lg:col-span-2">
          <SectionLabel>House status</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-dash-text-disabled">KDS backlog</p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums",
                  backlogHigh ? "text-red-300" : "text-dash-text"
                )}
              >
                {data.kdsBacklogMinutes != null
                  ? `${data.kdsBacklogMinutes} min`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-dash-text-disabled">Active orders</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-dash-text">
                {data.activeOrderCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-dash-text-disabled">Operating mode</p>
              <p className="mt-1 text-sm font-semibold capitalize text-dash-text-secondary">
                {data.operatingMode.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-dash-text-disabled">KDS stress</p>
              <p className="mt-1 text-sm font-semibold capitalize text-dash-text-secondary">
                {data.kdsStress}
              </p>
            </div>
          </div>

          {data.autoRushEnabled && backlogHigh ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-200">
              <AlertTriangle className="size-4 shrink-0" />
              Backlog exceeds auto-rush threshold ({data.autoRushBacklogMinutes}{" "}
              min).
            </p>
          ) : null}
        </QrCard>

        {data.canManageOps ? (
          <QrCard variant="muted" padding="md">
            <SectionLabel>Ops controls</SectionLabel>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-2 text-xs text-dash-text-muted">Mode</p>
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={
                        data.operatingMode === option.value
                          ? "default"
                          : "outline"
                      }
                      disabled={pending}
                      className="min-h-12"
                      onClick={() => applyMode(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-dash-text-muted">KDS stress</p>
                <div className="flex flex-wrap gap-2">
                  {(["normal", "high"] as const).map((stress) => (
                    <Button
                      key={stress}
                      type="button"
                      size="sm"
                      variant={
                        data.kdsStress === stress ? "default" : "outline"
                      }
                      disabled={pending}
                      className="min-h-12 capitalize"
                      onClick={() => applyKdsStress(stress)}
                    >
                      {stress}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </QrCard>
        ) : null}
      </section>

      <QrCard variant="muted" padding="md">
        <SectionLabel>Priority tables</SectionLabel>
        <div className="mt-3">
          <StaffCopilotTableList
            tables={data.priorityTables}
            emptyMessage="No tables need attention right now."
          />
        </div>
      </QrCard>

      {data.canSetTableHints ? (
        <QrCard variant="muted" padding="md">
          <SectionLabel>Table hint for Denis</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-dash-text-muted">
                Table
              </span>
              <select
                value={hintTableId}
                onChange={(e) => setHintTableId(e.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm text-dash-text outline-none focus:border-dash-accent/50"
              >
                <option value="">Select table…</option>
                {(activeTables.length ? activeTables : data.tables).map(
                  (table) => (
                    <option key={table.tableId} value={table.tableId}>
                      {table.tableName}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-dash-text-muted">
                Visibility
              </span>
              <select
                value={hintVisibility}
                onChange={(e) =>
                  setHintVisibility(
                    e.target.value as "denis_only" | "guest_safe"
                  )
                }
                className="mt-1 min-h-12 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm text-dash-text outline-none focus:border-dash-accent/50"
              >
                <option value="denis_only">Denis only (internal)</option>
                <option value="guest_safe">
                  Guest-safe (may appear in chat)
                </option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-dash-text-muted">
              Hint
            </span>
            <textarea
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. VIP birthday — offer complimentary dessert if they ask"
              className="mt-1 w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent/50"
            />
          </label>
          <Button
            type="button"
            disabled={pending}
            className="mt-3 min-h-12"
            onClick={submitHint}
          >
            Save hint
          </Button>
        </QrCard>
      ) : null}

      <p className="text-[11px] text-dash-text-disabled">
        Snapshot at {new Date(data.at).toLocaleTimeString()} · refreshes every
        30s
        {!data.floorGraphEnabled
          ? " · enable ops.floorGraphEnabled for auto-rush"
          : ""}
      </p>
    </div>
  );
}
