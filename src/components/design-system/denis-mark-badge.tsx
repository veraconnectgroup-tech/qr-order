import { DenisTableMark, type DenisTableMarkState } from "./denis-table-mark";
import { resolveDenisMoodColor } from "./denis-mood-color";
import { cn } from "@/lib/utils";

export type DenisMarkBadgeProps = {
  size?: "sm" | "md" | "lg";
  markState?: DenisTableMarkState;
  className?: string;
  /** 0 = calm brand ember, 1 = full alert red. */
  moodIntensity?: number;
};

const BOX: Record<NonNullable<DenisMarkBadgeProps["size"]>, string> = {
  sm: "size-8 rounded-lg",
  md: "size-9 rounded-lg",
  lg: "size-10 rounded-xl",
};

const MARK: Record<
  NonNullable<DenisMarkBadgeProps["size"]>,
  24 | 32 | 40
> = {
  sm: 24,
  md: 24,
  lg: 32,
};

/** Standard Denis Table D badge — use on every guest AI / Denis surface. */
export function DenisMarkBadge({
  size = "md",
  markState = "idle",
  className,
  moodIntensity,
}: DenisMarkBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center ring-1 ring-border",
        moodIntensity === undefined
          ? "bg-[var(--qr-ember-muted)]"
          : "transition-colors duration-700",
        BOX[size],
        className
      )}
      style={
        moodIntensity !== undefined
          ? { backgroundColor: resolveDenisMoodColor(moodIntensity, 0.12) }
          : undefined
      }
      aria-hidden
    >
      <DenisTableMark
        size={MARK[size]}
        state={markState}
        moodIntensity={moodIntensity}
      />
    </div>
  );
}

/** Sidebar / nav icon slot — same Table D mark at 1em. */
export function DenisNavIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex size-4 shrink-0 items-center justify-center", className)}
      aria-hidden
    >
      <DenisTableMark size={24} className="size-4 text-[var(--qr-ember)]" />
    </span>
  );
}
