"use client";

import { cn } from "@/lib/utils";

/** Minimal wrapper — spacing only, no decoration. */
export function ShowcaseAmbientStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

/**
 * Crops inner UI — partial visibility only. Never show full dashboard.
 * Showcase-only framing.
 */
export function ShowcaseCropFrame({
  children,
  className,
  innerClassName,
  aspect = "16/10",
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
          "scale-[1.18] -translate-x-[10%] -translate-y-[8%]",
          "sm:scale-[1.22] sm:-translate-x-[12%] sm:-translate-y-[10%]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Secondary device — quiet background layer. */
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
        "pointer-events-none absolute z-20 hidden opacity-[0.72] md:block",
        "bottom-[10%] left-[3%] w-[32%] min-w-[132px] max-w-[168px]",
        className
      )}
    >
      <div className="relative -rotate-[2deg]">{children}</div>
    </div>
  );
}
