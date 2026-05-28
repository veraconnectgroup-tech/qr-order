"use client";

import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { cn } from "@/lib/utils";

export function DenisMessageBlock({
  role,
  children,
  className,
}: {
  role: "assistant" | "user";
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (role === "user") {
    return (
      <div className={cn("flex w-full min-w-0 justify-end px-1", className)}>
        <p className="max-w-[min(85%,calc(100vw-2rem))] whitespace-pre-wrap break-words rounded-xl bg-[var(--qr-surface)] px-4 py-2.5 text-right text-[15px] leading-[1.6] text-[var(--qr-muted)]">
          {children}
        </p>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "space-y-3 rounded-xl border border-[var(--qr-elevated)] border-l-2 border-l-[var(--qr-ember)] bg-[var(--qr-elevated)] px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <DenisMarkBadge size="sm" />
        <span className="text-xs tracking-wide text-[var(--qr-muted)]">Denis</span>
      </div>
      {children}
    </article>
  );
}

/** Prefer header presence line; keep minimal fallback for legacy call sites. */
export function DenisMessageThinking() {
  return (
    <span
      className="denis-presence-line denis-mark-think mx-1 my-2 inline-block w-12"
      aria-hidden
    />
  );
}

export function DenisThreadLabel() {
  return null;
}
