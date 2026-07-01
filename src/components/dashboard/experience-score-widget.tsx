"use client";

import { AlertTriangle } from "lucide-react";
import { QrCard } from "@/components/design-system/qr-card";
import type { ExperienceScoreSnapshot } from "@/lib/dashboard/load-experience-score";
import { cn } from "@/lib/utils";

function scoreTone(score: number | null): string {
  if (score == null) return "text-dash-text-disabled";
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-300";
  return "text-red-400";
}

export function ExperienceScoreWidget({
  snapshot,
  loading,
}: {
  snapshot: ExperienceScoreSnapshot | null;
  loading?: boolean;
}) {
  const latest = snapshot?.latestScore ?? null;
  const trend = snapshot?.trend ?? [];
  const peak = Math.max(...trend.map((row) => row.score), 100);

  return (
    <QrCard className="border-dash-border-subtle bg-dash-surface-raised">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            Experience score
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-3xl font-bold",
              scoreTone(latest),
              loading && "opacity-50"
            )}
          >
            {latest != null ? latest.toFixed(0) : "—"}
          </p>
          <p className="mt-1 text-xs text-dash-text-disabled">
            Automated daily quality · no survey required
          </p>
        </div>
        {snapshot?.alert && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
            <AlertTriangle className="size-3.5" aria-hidden />
            Alert
          </span>
        )}
      </div>

      {trend.length > 1 && (
        <div className="mt-4 flex h-10 items-end gap-px">
          {trend.map((point) => (
            <div
              key={point.date}
              className="min-w-[3px] flex-1 rounded-sm bg-dash-accent/60"
              style={{ height: `${Math.max(8, (point.score / peak) * 100)}%` }}
              title={`${point.date}: ${point.score}`}
            />
          ))}
        </div>
      )}

      {snapshot?.alert && (
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-100">
          <p>{snapshot.alert.message}</p>
          {snapshot.alert.hint && (
            <p className="mt-1 text-xs text-amber-200/80">{snapshot.alert.hint}</p>
          )}
        </div>
      )}
    </QrCard>
  );
}
