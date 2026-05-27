import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type QrKpiProps = {
  label: string;
  value: string;
  sublabel?: string;
  delta?: ReactNode;
  footer?: ReactNode;
  accent?: boolean;
  className?: string;
  loading?: boolean;
};

export function QrKpi({
  label,
  value,
  sublabel,
  delta,
  footer,
  accent = false,
  className,
  loading,
}: QrKpiProps) {
  if (loading) {
    return (
      <Skeleton
        className={cn(
          "h-[120px] min-w-[168px] shrink-0 rounded-xl bg-dash-surface-raised lg:min-w-0",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-dash-border bg-dash-surface p-3 text-left",
        accent && "border-[var(--qr-ember)]",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight text-dash-text">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs text-dash-text-disabled">{sublabel}</p>
      ) : null}
      {delta ? <div className="mt-1.5">{delta}</div> : null}
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
