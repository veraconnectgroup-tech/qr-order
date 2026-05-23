import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsMetricCard({
  label,
  value,
  hint,
  changePct,
}: {
  label: string;
  value: string;
  hint?: string;
  changePct?: number;
}) {
  const hasChange = changePct !== undefined && Number.isFinite(changePct);
  const positive = (changePct ?? 0) >= 0;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">
        {value}
      </p>
      {hasChange && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            positive ? "text-green-600" : "text-red-600"
          )}
        >
          {positive ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )}
          {Math.abs(changePct).toFixed(1)}% vs previous period
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
