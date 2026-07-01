"use client";

import {
  DenisMarkBadge,
  type DenisMarkBadgeProps,
} from "@/components/design-system/denis-mark-badge";
import { cn } from "@/lib/utils";

export function DenisMessageBlock({
  role,
  children,
  className,
  markState = "idle",
}: {
  role: "assistant" | "user";
  label?: string;
  children: React.ReactNode;
  className?: string;
  markState?: DenisMarkBadgeProps["markState"];
}) {
  if (role === "user") {
    return (
      <div className={cn("flex w-full min-w-0 justify-end px-1", className)}>
        <p className="max-w-[min(85%,calc(100vw-2rem))] whitespace-pre-wrap break-words rounded-xl border border-[var(--qr-ember)]/25 bg-[var(--denis-bubble-user,var(--qr-surface))] px-4 py-2.5 text-right text-[15px] leading-[1.6] text-[var(--qr-ivory)]">
          {children}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-start gap-2.5 px-1",
        className
      )}
    >
      <DenisMarkBadge size="lg" markState={markState} className="mt-0.5" />

      <article className="min-w-0 flex-1 space-y-2 rounded-xl border border-[var(--qr-elevated)] border-l-2 border-l-[var(--qr-ember)] bg-[var(--denis-bubble-assistant,var(--qr-elevated))] px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--qr-ivory)]">
            Denis
          </p>
          <span
            className={cn(
              "denis-presence-line w-10",
              markState === "listen" && "denis-presence-line--listen",
              markState === "think" && "denis-mark-think"
            )}
            aria-hidden
          />
        </div>
        {children}
      </article>
    </div>
  );
}

/** Contextual thinking label while Denis processes a guest turn. */
export function DenisMessageThinking({ label }: { label?: string | null }) {
  const text = label?.trim() || null;

  return (
    <div className="flex w-full min-w-0 items-start gap-2.5 px-1">
      <DenisMarkBadge size="lg" markState="think" className="mt-0.5" />
      <div className="flex min-h-[2.5rem] flex-1 items-center rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-elevated)] px-4 py-3">
        {text ? (
          <p
            key={text}
            className="flex items-center gap-1 text-[15px] leading-[1.5] text-[var(--qr-muted)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          >
            <span>{text}</span>
            <span className="denis-thinking-dots inline-flex w-5" aria-hidden>
              <span className="denis-thinking-dot" />
              <span className="denis-thinking-dot" />
              <span className="denis-thinking-dot" />
            </span>
          </p>
        ) : (
          <span
            className="denis-presence-line denis-mark-think inline-block w-12"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function DenisThreadLabel() {
  return null;
}
