"use client";

import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import {
  floorHintLabel,
  staffCopilotPriorityLabel,
  type StaffCopilotTablePriority,
  type StaffCopilotTableRow,
  type StaffRevenueOpportunity,
} from "@/lib/denis/venue/copilot";
import { cn } from "@/lib/utils";

function priorityStyles(priority: StaffCopilotTablePriority) {
  switch (priority) {
    case "urgent":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "high":
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    case "normal":
      return "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
    case "idle":
      return "bg-dash-surface-raised text-dash-text-muted border-dash-border";
  }
}

export function PriorityBadge({
  priority,
}: {
  priority: StaffCopilotTablePriority;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        priorityStyles(priority)
      )}
    >
      {staffCopilotPriorityLabel(priority)}
    </span>
  );
}

function revenueOpportunityTitle(
  opportunity: StaffRevenueOpportunity
): string | null {
  if (!opportunity) return null;
  if (typeof opportunity === "string") return opportunity;
  return opportunity.title;
}

export function HintBadge({
  hint,
}: {
  hint: StaffCopilotTableRow["operatingHint"];
}) {
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

export function DenisStaffHintBlock({
  tableName,
  text,
  visibility,
}: {
  tableName: string;
  text: string;
  visibility: "denis_only" | "guest_safe";
}) {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-dash-border border-l-2 border-l-dash-accent bg-dash-bg/70 px-3 py-2.5">
      <DenisMarkBadge
        size="sm"
        className="mt-0.5 bg-dash-accent-muted ring-dash-border-subtle"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-dash-text-secondary">
          <span className="font-medium text-dash-text">{tableName}</span> —{" "}
          {text}
        </p>
        <p className="mt-1 text-[11px] text-dash-text-muted">
          {visibility === "guest_safe"
            ? "Guest-safe — may appear in Denis chat"
            : "Denis only — internal staff hint"}
        </p>
      </div>
    </div>
  );
}

export function TableCopilotRow({ table }: { table: StaffCopilotTableRow }) {
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
        <PriorityBadge priority={table.priority} />
      </div>
      {table.staffBrief ? (
        <p className="mt-2 text-sm leading-relaxed text-dash-text-secondary">
          {table.staffBrief}
        </p>
      ) : null}
      {table.staffHint && !table.staffBrief?.includes(table.staffHint.text) ? (
        <DenisStaffHintBlock
          tableName={table.tableName}
          text={table.staffHint.text}
          visibility={table.staffHint.visibility}
        />
      ) : null}
      {revenueOpportunityTitle(table.revenueOpportunity) ? (
        <p className="mt-2 text-xs font-medium text-dash-accent">
          {revenueOpportunityTitle(table.revenueOpportunity)}
        </p>
      ) : null}
    </div>
  );
}

export function DenisStaffTableBrief({ table }: { table: StaffCopilotTableRow }) {
  const hintLabel = floorHintLabel(table.operatingHint);

  return (
    <div className="rounded-lg border border-dash-border border-l-2 border-l-dash-accent bg-dash-bg/70 p-3">
      <div className="flex items-start gap-2.5">
        <DenisMarkBadge
          size="sm"
          className="mt-0.5 bg-dash-accent-muted ring-dash-border-subtle"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dash-text">{table.tableName}</p>
          <p className="mt-1 text-xs text-dash-text-muted">
            {table.hasActiveSession
              ? table.seatedMinutes != null
                ? `Seated ${table.seatedMinutes} min`
                : "Active session"
              : "No session"}
            {table.openOrderCount > 0
              ? ` · ${table.openOrderCount} open order${table.openOrderCount === 1 ? "" : "s"}`
              : ""}
            {hintLabel ? ` · ${hintLabel}` : ""}
            {table.guestWaitMinutes != null && table.guestWaitMinutes >= 5
              ? ` · čeka ${table.guestWaitMinutes}min`
              : ""}
          </p>
          {table.staffBrief ? (
            <p className="mt-2 text-sm leading-relaxed text-dash-text-secondary">
              {table.staffBrief}
            </p>
          ) : table.staffHint ? (
            <p className="mt-2 text-sm leading-relaxed text-dash-text-secondary">
              {table.staffHint.text}
            </p>
          ) : null}
          {revenueOpportunityTitle(table.revenueOpportunity) ? (
            <p className="mt-2 text-xs font-medium text-dash-accent">
              {revenueOpportunityTitle(table.revenueOpportunity)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StaffCopilotTableList({
  tables,
  emptyMessage,
}: {
  tables: StaffCopilotTableRow[];
  emptyMessage: string;
}) {
  if (tables.length === 0) {
    return <p className="text-sm text-dash-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {tables.map((table) => (
        <TableCopilotRow key={table.tableId} table={table} />
      ))}
    </div>
  );
}
