"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function DenisPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex max-h-[min(88dvh,720px)] min-h-[min(68dvh,540px)] flex-col overflow-hidden rounded-[20px] border border-[var(--qr-elevated)] bg-[var(--qr-void)] text-[var(--qr-ivory)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DenisPanelHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[var(--qr-elevated)] bg-[var(--qr-surface)]/90 px-3 py-3 backdrop-blur-md sm:gap-3 sm:px-4",
        className
      )}
    >
      {children}
    </header>
  );
}

export const DenisPanelBody = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function DenisPanelBody({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function DenisPanelFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--qr-elevated)] bg-[var(--qr-void)] px-4 pt-3 pb-safe",
        className
      )}
    >
      {children}
    </div>
  );
}
