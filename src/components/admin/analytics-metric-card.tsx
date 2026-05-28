import { ArrowDown, ArrowUp } from "lucide-react";
import { QrCard } from "@/components/design-system/qr-card";
import { cn } from "@/lib/utils";

export function AnalyticsMetricCard({
  label,
  value,
  hint,
  changePct,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  changePct?: number;
  tone?: "default" | "warning";
}) {
  const hasChange = changePct !== undefined && Number.isFinite(changePct);
  const positive = (changePct ?? 0) >= 0;

  return (
    <QrCard
      className={cn(
        tone === "warning" && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <p
        className={cn(
          "text-sm",
          tone === "warning" ? "text-amber-700" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-3xl font-bold",
          tone === "warning" ? "text-amber-900" : "text-foreground"
        )}
      >
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
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </QrCard>
  );
}
