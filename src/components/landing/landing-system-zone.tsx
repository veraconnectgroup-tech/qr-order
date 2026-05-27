"use client";

import { cn } from "@/lib/utils";

/** Continuous operational surface — typography labels only, no feature sections. */
export function LandingSystemZone({
  id,
  label,
  meta,
  children,
  className,
  surfaceClassName,
}: {
  id?: string;
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  surfaceClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-14 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--lp-border-subtle)] px-6 py-3 lg:px-8">
        <h2 className="landing-zone-label">{label}</h2>
        {meta}
      </div>

      <div className={cn("landing-surface relative", surfaceClassName)}>{children}</div>
    </section>
  );
}

export function SystemLiveMeta({ label = "Live" }: { label?: string }) {
  return (
    <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--lp-muted)]">
      <span className="size-1.5 rounded-full bg-emerald-500/90 pulse-dot" aria-hidden />
      <span>{label}</span>
    </p>
  );
}
