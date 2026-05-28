"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
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
      <div className={cn("flex justify-end px-1", className)}>
        <p className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-[var(--qr-surface)] px-4 py-2.5 text-right text-[15px] leading-[1.6] text-[var(--qr-muted)]">
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
        <DenisTableMark size={24} state="idle" className="size-5 opacity-90" />
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
