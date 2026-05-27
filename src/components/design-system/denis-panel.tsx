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
        "flex max-h-[min(88dvh,720px)] min-h-[min(68dvh,540px)] flex-col overflow-hidden rounded-2xl bg-[var(--qr-void)] text-[var(--qr-ivory)]",
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
        "flex shrink-0 items-center gap-3 px-5 py-4 sm:px-6",
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
        "min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-2 sm:px-6",
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
    <div className={cn("shrink-0 px-5 pt-2 pb-safe sm:px-6", className)}>
      {children}
    </div>
  );
}
