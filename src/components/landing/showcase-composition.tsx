"use client";

import { cn } from "@/lib/utils";

/** Ambient stage for hero / feature product cinematography. */
export function ShowcaseAmbientStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[12%] -z-10 bg-[radial-gradient(ellipse_70%_55%_at_62%_42%,rgba(255,255,255,0.045),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.35)_100%)]"
      />
      {children}
    </div>
  );
}

/**
 * Crops and scales inner product UI — Cursor/Linear partial visibility.
 * Does not change product components; only frames them.
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
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#0a0908] ring-1 ring-white/[0.05]",
        "shadow-[0_48px_120px_-48px_rgba(0,0,0,0.92)]",
        className
      )}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 size-full origin-top-left",
          "scale-[1.08] -translate-x-[4%] -translate-y-[2%]",
          "sm:scale-[1.06] sm:-translate-x-[5%] sm:-translate-y-[3%]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Floating secondary device — one phone overlay, natural depth. */
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
        "pointer-events-none absolute z-20 hidden w-[26%] min-w-[128px] max-w-[176px] lg:block",
        "-bottom-[8%] -right-[2%] xl:max-w-[188px]",
        className
      )}
    >
      <div className="rotate-[-2deg] drop-shadow-[0_28px_60px_rgba(0,0,0,0.55)] sm:rotate-[-3deg]">
        {children}
      </div>
    </div>
  );
}
