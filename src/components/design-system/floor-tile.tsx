import { cn } from "@/lib/utils";
export {
  floorTileStatusFromTable,
  tableTileStatus,
} from "@/lib/dashboard/table-tile-status";
import type {
  FloorTileProps,
  FloorTileStatus,
  FloorTileVariant,
} from "./floor-tile.types";

const floorStatusClasses: Record<FloorTileStatus, string> = {
  available:
    "border-dashed border-dash-surface-overlay bg-dash-bg/50",
  occupied:
    "relative overflow-hidden border-emerald-500/40 ring-1 ring-emerald-500/30 before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-[var(--qr-ember)] before:content-[''] spatial-tile-occupy",
  attention:
    "animate-pulse border-red-500 ring-1 ring-emerald-500/30",
  payment:
    "animate-pulse border-amber-500 ring-1 ring-emerald-500/30",
  selected:
    "border-[var(--qr-ember)] ring-1 ring-[var(--qr-ember-glow)]",
};

const variantBaseClasses: Record<FloorTileVariant, string> = {
  floor:
    "rounded-xl border bg-dash-surface p-3 text-center transition hover:border-dash-surface-overlay sm:p-5",
  kpi: "rounded-xl border border-dash-border bg-dash-surface text-left transition",
  chip:
    "inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-[var(--denis-chip-border)] bg-[var(--qr-ember-muted)] px-4 text-sm font-medium text-dash-text transition hover:border-[var(--qr-ember)] hover:bg-dash-surface-raised",
};

function floorTileClasses({
  variant = "floor",
  status = "available",
  highlight = false,
  compact = false,
  className,
}: Pick<
  FloorTileProps,
  "variant" | "status" | "highlight" | "compact" | "className"
>) {
  return cn(
    variantBaseClasses[variant],
    variant === "floor" && floorStatusClasses[status],
    variant === "kpi" &&
      cn(
        compact ? "p-3" : "p-4",
        status === "selected" && "border-[var(--qr-ember)]"
      ),
    variant === "chip" &&
      cn(
        highlight && "border-[var(--qr-ember)] bg-[var(--qr-ember-muted)]",
        status === "selected" && "border-[var(--qr-ember)] ring-1 ring-[var(--qr-ember-glow)]"
      ),
    className
  );
}

function FloorTileContent({
  variant = "floor",
  label,
  sublabel,
  value,
  children,
}: Pick<
  FloorTileProps,
  "variant" | "label" | "sublabel" | "value" | "children"
>) {
  if (variant === "chip") {
    return (
      <>
        <span>{label}</span>
        {children}
      </>
    );
  }

  if (variant === "kpi") {
    return (
      <>
        <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-muted">
          {label}
        </p>
        {value ? (
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-dash-text">
            {value}
          </p>
        ) : null}
        {sublabel ? (
          <p className="mt-1 text-xs text-dash-text-disabled">{sublabel}</p>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-base font-bold text-dash-text sm:text-xl">
        {label}
      </p>
      {sublabel ? (
        <p className="mt-1 text-sm text-dash-text-disabled">{sublabel}</p>
      ) : null}
      {value ? (
        <p className="mt-1 font-mono text-[var(--qr-ember)]">{value}</p>
      ) : null}
      {children}
    </>
  );
}

export function FloorTile({
  variant = "floor",
  status = "available",
  label,
  sublabel,
  value,
  highlight = false,
  compact = false,
  as = "div",
  href,
  onClick,
  disabled = false,
  className,
  style,
  children,
}: FloorTileProps) {
  const classes = floorTileClasses({
    variant,
    status,
    highlight,
    compact,
    className,
  });

  const content = (
    <FloorTileContent
      variant={variant}
      label={label}
      sublabel={sublabel}
      value={value}
    >
      {children}
    </FloorTileContent>
  );

  if (as === "a") {
    return (
      <a
        href={href}
        onClick={onClick}
        className={cn("cursor-pointer", classes)}
        style={style}
        aria-label={label}
      >
        {content}
      </a>
    );
  }

  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          classes
        )}
        style={style}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return <div className={classes} style={style}>{content}</div>;
}
