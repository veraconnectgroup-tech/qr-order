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

/** Partial visibility — crop keeps focus without hiding the product. */
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
          "scale-[1.14] -translate-x-[8%] -translate-y-[6%]",
          "sm:scale-[1.16] sm:-translate-x-[10%] sm:-translate-y-[7%]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Secondary device — physical, present, not dominant. */
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
        "bottom-[10%] left-[5%] w-[32%] min-w-[132px] max-w-[168px]",
        className
      )}
    >
      <div className="relative translate-y-1 -rotate-[1.25deg]">{children}</div>
    </div>
  );
}
