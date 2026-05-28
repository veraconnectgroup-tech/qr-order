"use client";

import type { ComponentType, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCard } from "@/components/design-system/qr-card";
import { cn } from "@/lib/utils";

export function OverviewKpiCard({
  label,
  value,
  icon: Icon,
  compare,
  highlight,
  loading,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  compare?: ReactNode;
  highlight?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-[108px] rounded-xl bg-dash-surface-raised" />;
  }

  return (
    <QrCard variant="muted" padding="md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
          {label}
        </p>
        <Icon className="size-4 text-dash-text-disabled" />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          highlight ? "text-dash-accent" : "text-dash-text"
        )}
      >
        {value}
      </p>
      {compare}
    </QrCard>
  );
}
