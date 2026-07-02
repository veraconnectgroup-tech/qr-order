import { cn } from "@/lib/utils";

/** Soft product stage — tinted backdrop + depth, nimt-style. */
export function LandingVisualStage({
  children,
  className,
  variant = "panel",
}: {
  children: React.ReactNode;
  className?: string;
  /** panel = tinted pad; phone = center a device mockup; flush = no pad */
  variant?: "panel" | "phone" | "flush";
}) {
  return (
    <div
      className={cn(
        variant === "panel" &&
          "rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-tint)] p-5 sm:p-8",
        variant === "phone" &&
          "flex justify-center rounded-2xl border border-[var(--lp-border-subtle)] bg-[var(--lp-tint)] px-5 py-8 sm:px-10 sm:py-10",
        variant === "flush" && "min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
