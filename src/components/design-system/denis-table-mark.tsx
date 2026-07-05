import { cn } from "@/lib/utils";
import { resolveDenisMoodColor } from "./denis-mood-color";

export type DenisTableMarkState = "idle" | "listen" | "think";

export type DenisTableMarkProps = {
  size?: 24 | 32 | 40;
  state?: DenisTableMarkState;
  className?: string;
  /** 0 = calm brand ember, 1 = full alert red — e.g. an unanswered station question aging out. */
  moodIntensity?: number;
};

/** Table D — vertical spine + top bar + leg (Denis spatial v4, ADR-007). */
export function DenisTableMark({
  size = 24,
  state = "idle",
  className,
  moodIntensity,
}: DenisTableMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={
        moodIntensity !== undefined
          ? { color: resolveDenisMoodColor(moodIntensity) }
          : undefined
      }
      className={cn(
        "shrink-0",
        moodIntensity !== undefined
          ? "transition-colors duration-700"
          : "text-[var(--qr-ember)]",
        state === "listen" && "denis-table-mark--listen",
        state === "think" && "denis-table-mark--think",
        className
      )}
    >
      {/* Left spine */}
      <path
        d="M6 4v16"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Top bar */}
      <path
        d="M6 4h10"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Upper leg */}
      <path
        d="M16 4v9"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* D bowl — diagonal close so mark reads as D, not a sparkle */}
      <path
        d="M16 13L6 20"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
