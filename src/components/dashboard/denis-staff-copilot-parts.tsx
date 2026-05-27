"use client";

import {
  DenisMessageBlock,
  DenisThreadLabel,
} from "@/components/design-system/denis-message-block";
import {
  floorHintLabel,
  type StaffCopilotTableRow,
} from "@/lib/denis/venue/copilot";
import { cn } from "@/lib/utils";

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

/** DE-07 — staff hints use Denis block gramat (same as guest panel). */
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
    <DenisMessageBlock role="assistant" className="mt-3 rounded-xl bg-[var(--qr-void)]/40 p-2">
      <DenisThreadLabel />
      <p className="text-sm leading-relaxed text-[var(--qr-ivory)]">
        <span className="font-medium">{tableName}</span> — {text}
      </p>
      <p className="mt-1 text-[11px] text-[var(--qr-muted)]">
        {visibility === "guest_safe"
          ? "Guest-safe — may appear in Denis chat"
          : "Denis only — internal staff hint"}
      </p>
    </DenisMessageBlock>
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
      </div>
      {table.staffHint ? (
        <DenisStaffHintBlock
          tableName={table.tableName}
          text={table.staffHint.text}
          visibility={table.staffHint.visibility}
        />
      ) : null}
    </div>
  );
}

export function DenisStaffTableBrief({ table }: { table: StaffCopilotTableRow }) {
  const hintLabel = floorHintLabel(table.operatingHint);

  return (
    <DenisMessageBlock role="assistant" className="rounded-xl border border-[var(--qr-elevated)]/80 p-3">
      <DenisThreadLabel />
      <p className="text-sm font-semibold text-[var(--qr-ivory)]">
        {table.tableName}
      </p>
      <p className="mt-1 text-xs text-[var(--qr-muted)]">
        {table.hasActiveSession
          ? table.seatedMinutes != null
            ? `Seated ${table.seatedMinutes} min`
            : "Active session"
          : "No session"}
        {table.openOrderCount > 0
          ? ` · ${table.openOrderCount} open order${table.openOrderCount === 1 ? "" : "s"}`
          : ""}
        {hintLabel ? ` · ${hintLabel}` : ""}
      </p>
      {table.staffHint ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--qr-ivory)]">
          {table.staffHint.text}
        </p>
      ) : null}
    </DenisMessageBlock>
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
