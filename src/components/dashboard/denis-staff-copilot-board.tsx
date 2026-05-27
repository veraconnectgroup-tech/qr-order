"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Bot,
  Clock,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useDenisStaffCopilot } from "@/hooks/use-denis-staff-copilot";
import {
  floorHintLabel,
  type StaffCopilotTableRow,
} from "@/lib/denis/venue/copilot";
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

function HintBadge({ hint }: { hint: StaffCopilotTableRow["operatingHint"] }) {
  const label = floorHintLabel(hint);
  if (!label) return null;

  const styles =
    hint === "needs_attention"
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : hint === "ready_for_dessert"
        ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
        : "bg-dash-surface-raised text-dash-text-muted border-dash-border";

  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        styles
      )}
    >
      {label}
    </span>
  );
}

function TableCopilotRow({ table }: { table: StaffCopilotTableRow }) {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-bg/60 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-dash-text">{table.tableName}</p>
          <p className="mt-0.5 text-xs text-dash-text-muted">
            {table.hasActiveSession
              ? table.seatedMinutes != null
                ? `Seated ${table.seatedMinutes} min`
                : "Active session"
              : "No session"}
            {table.openOrderCount > 0
              ? ` · ${table.openOrderCount} open order${table.openOrderCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <HintBadge hint={table.operatingHint} />
      </div>
      {table.staffHint ? (
        <p className="mt-2 text-sm text-dash-text-secondary">
          <span className="font-medium text-dash-accent">Hint:</span>{" "}
          {table.staffHint.text}
          <span className="ms-2 text-[11px] text-dash-text-disabled">
            ({table.staffHint.visibility === "guest_safe" ? "guest-safe" : "Denis only"})
          </span>
        </p>
      ) : null}
    </div>
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
      <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
        <p className="text-sm text-dash-text-muted">{error}</p>
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-6 text-center">
        <Bot className="mx-auto size-8 text-dash-text-disabled" />
        <p className="mt-3 text-sm text-dash-text-muted">
          Denis is not enabled for this location. Turn on Denis in admin
          settings.
        </p>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
            Venue OS
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-dash-text sm:text-2xl">
            <Sparkles className="size-5 text-dash-accent" />
            Denis
          </h2>
          <p className="mt-1 text-sm text-dash-text-muted">
            Floor priorities, rush mode, and table hints.
          </p>
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
        <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            House status
          </p>
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
        </div>

        {data.canManageOps ? (
          <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
              Ops controls
            </p>
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
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="size-4 text-dash-accent" />
          <h3 className="text-sm font-semibold text-dash-text">
            Priority tables
          </h3>
        </div>
        {data.priorityTables.length === 0 ? (
          <p className="text-sm text-dash-text-muted">
            No tables need attention right now.
          </p>
        ) : (
          <div className="space-y-2">
            {data.priorityTables.map((table) => (
              <TableCopilotRow key={table.tableId} table={table} />
            ))}
          </div>
        )}
      </section>

      {data.canSetTableHints ? (
        <section className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-dash-accent" />
            <h3 className="text-sm font-semibold text-dash-text">
              Table hint for Denis
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
                <option value="guest_safe">Guest-safe (may appear in chat)</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-dash-text-muted">Hint</span>
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
        </section>
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
