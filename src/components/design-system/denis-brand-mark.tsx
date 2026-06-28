"use client";

import { DenisTableMark, type DenisTableMarkState } from "./denis-table-mark";
import { useVenueThemeOptional } from "@/components/theme/venue-theme-context";
import { cn } from "@/lib/utils";

export type DenisBrandMarkProps = {
  className?: string;
  markSize?: 24 | 32 | 40;
  markState?: DenisTableMarkState;
  markOnly?: boolean;
  displayName?: string;
  subline?: string;
};

export function DenisBrandMark({
  className,
  markSize = 24,
  markState = "idle",
  markOnly = false,
  displayName: displayNameProp,
  subline: sublineProp,
}: DenisBrandMarkProps) {
  const theme = useVenueThemeOptional();
  const displayName = displayNameProp ?? theme?.displayName ?? "Denis";
  const subline =
    sublineProp ?? theme?.theme.productSubline ?? "Part of Vera Group";

  if (markOnly) {
    return (
      <div className={cn("flex flex-col items-start gap-1.5", className)}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--qr-ember-muted)] ring-1 ring-border">
          <DenisTableMark size={markSize} state={markState} />
        </div>
        {markState === "listen" ? (
          <span
            className="denis-presence-line denis-presence-line--listen w-9"
            aria-hidden
          />
        ) : null}
        {markState === "think" ? (
          <span className="denis-presence-line denis-mark-think w-9" aria-hidden />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--qr-ember-muted)] ring-1 ring-border"
        aria-hidden
      >
        <DenisTableMark size={markSize} state={markState} />
      </div>
      <div className="min-w-0">
        <div className="inline-block min-w-0">
          <p className="text-sm font-bold tracking-tight text-dash-text">
            {displayName}
          </p>
          <span
            className={cn(
              "denis-presence-line",
              markState === "listen" && "denis-presence-line--listen",
              markState === "think" && "denis-mark-think"
            )}
          />
        </div>
        <p className="text-[11px] font-medium leading-snug text-dash-text-muted">
          {subline}
        </p>
      </div>
    </div>
  );
}
