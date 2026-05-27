import { cn } from "@/lib/utils";

export type DenisTableMarkState = "idle" | "listen" | "think";

export type DenisTableMarkProps = {
  size?: 24 | 32 | 40;
  state?: DenisTableMarkState;
  className?: string;
};

export function DenisTableMark({
  size = 24,
  state = "idle",
  className,
}: DenisTableMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0 text-[var(--qr-ember)]", className)}
    >
      <line
        x1="6"
        y1="4"
        x2="6"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="4"
        x2="16"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="4"
        x2="16"
        y2="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
