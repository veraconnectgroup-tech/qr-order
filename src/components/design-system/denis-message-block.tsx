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
        <p className="max-w-[85%] whitespace-pre-wrap text-right text-[15px] leading-[1.6] text-[var(--qr-muted)]">
          {children}
        </p>
      </div>
    );
  }

  return (
    <article className={cn("space-y-4 px-1", className)}>
      {children}
    </article>
  );
}

export function DenisMessageThinking() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-[var(--qr-muted)]/60"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

export function DenisThreadLabel() {
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <DenisTableMark size={24} state="idle" className="size-4 opacity-80" />
      <span className="text-xs tracking-wide text-[var(--qr-muted)]">Denis</span>
    </div>
  );
}
