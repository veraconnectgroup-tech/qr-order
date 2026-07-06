import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function OverviewPanel({
  title,
  actionHref,
  actionLabel,
  muted,
  fill,
  flat,
  children,
  className,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  muted?: boolean;
  fill?: boolean;
  flat?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden",
        flat
          ? cn(
              "overview-v3-panel-shell",
              muted && "overview-v3-panel-shell--muted",
              fill && "flex h-full min-h-0 flex-col"
            )
          : cn(
              "overview-v3-surface rounded-xl",
              muted && "overview-v3-surface--muted",
              fill && "flex min-h-0 flex-col"
            ),
        className
      )}
    >
      <header className="overview-v3-panel-header relative">
        <h2 className="overview-v3-section-title">{title}</h2>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="overview-v3-link">
            {actionLabel}
          </Link>
        ) : null}
      </header>
      <div
        className={cn(
          "px-4 py-3",
          fill && "flex min-h-0 flex-1 flex-col overflow-hidden"
        )}
      >
        {children}
      </div>
    </section>
  );
}
