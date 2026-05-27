"use client";

import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { cn } from "@/lib/utils";

export function DenisMessageBlock({
  role,
  label = "Denis",
  children,
  className,
}: {
  role: "assistant" | "user";
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className={cn("flex justify-end", className)}>
        <div className="max-w-[85%] rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--qr-ivory)]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-[var(--qr-border,var(--qr-elevated))] border-l-2 border-l-[var(--qr-ember)] bg-[var(--qr-elevated)] px-4 py-3",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--qr-surface)]">
          <DenisTableMark size={24} state="idle" className="size-3.5" />
        </span>
        <span className="text-xs font-medium text-[var(--qr-muted)]">{label}</span>
      </div>
      <div className="text-sm leading-relaxed text-[var(--qr-ivory)]">{children}</div>
    </article>
  );
}

export function DenisMessageThinking() {
  return (
    <DenisMessageBlock role="assistant">
      <div className="flex items-center gap-1.5 py-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-bounce rounded-full bg-[var(--qr-muted)]"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
    </DenisMessageBlock>
  );
}
