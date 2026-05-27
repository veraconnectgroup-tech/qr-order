"use client";

import { cn } from "@/lib/utils";

/** Minimal wrapper — spacing only. */
export function ShowcaseAmbientStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

/** Partial visibility only — never the full surface. */
export function ShowcaseCropFrame({
  children,
  className,
  innerClassName,
  aspect = "16/11",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  aspect?: string | null;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-[#09090b]", className)}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 size-full origin-top-left",
          "scale-[1.28] -translate-x-[14%] -translate-y-[12%]",
          "sm:scale-[1.32] sm:-translate-x-[16%] sm:-translate-y-[14%]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Secondary device — physical, quiet, background. */
export function ShowcaseFloatDevice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 hidden md:block",
        "bottom-[14%] left-[6%] w-[28%] min-w-[118px] max-w-[148px]",
        "opacity-[0.52]",
        className
      )}
    >
      <div className="relative translate-y-1 -rotate-[1.5deg]">{children}</div>
    </div>
  );
}
