"use client";

import { cn } from "@/lib/utils";

/** Application-grade operational surface — not a marketing feature row. */
export function LandingSystemZone({
  id,
  index,
  label,
  caption,
  meta,
  children,
  className,
  surfaceClassName,
}: {
  id?: string;
  index: string;
  label: string;
  caption?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  surfaceClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-14 border-t border-zinc-800/80 bg-[#08080c]", className)}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/60 px-6 py-3 lg:px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
            {index}
          </span>
          <h2 className="truncate text-[13px] font-medium tracking-tight text-zinc-300">
            {label}
          </h2>
          {caption && (
            <span className="hidden truncate text-[12px] text-zinc-600 sm:inline">
              {caption}
            </span>
          )}
        </div>
        {meta}
      </div>

      <div className={cn("relative bg-[#09090b]", surfaceClassName)}>{children}</div>
    </section>
  );
}

export function SystemLiveMeta({ label = "Live" }: { label?: string }) {
  return (
    <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
      <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
      <span>{label}</span>
    </p>
  );
}
