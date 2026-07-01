"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { toast } from "sonner";
import { applyThresholdOptimization } from "@/lib/admin/denis-threshold-actions";
import type { ThresholdOptimizationSnapshot } from "@/lib/admin/load-threshold-optimization";
import { Button } from "@/components/ui/button";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function DenisThresholdOptimizationPanel({
  snapshot,
}: {
  snapshot: ThresholdOptimizationSnapshot;
}) {
  const [pending, startTransition] = useTransition();

  if (snapshot.metrics.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Gauge className="mt-0.5 size-5 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold">Timing optimizacija</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Još nema dovoljno nudge podataka po bucketu (min 50 po bucketu,
              M3).
            </p>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link href="/dashboard/optimization">Pogledaj graf u Dashboardu</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function onApply() {
    startTransition(async () => {
      const outcome = await applyThresholdOptimization(snapshot.suggestions);
      if (!outcome.ok) {
        toast.error(outcome.error ?? "Apply failed.");
        return;
      }
      toast.success("Thresholdovi primenjeni.");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Gauge className="mt-0.5 size-5 text-orange-500" />
        <div>
          <h2 className="text-lg font-semibold">Timing optimizacija</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Denis uči optimalne proactive thresholdove iz konverzija — primena
            zahteva odobrenje vlasnika (auto_apply=
            {snapshot.autoApply ? "true" : "false"}).
          </p>
        </div>
      </div>

      {snapshot.ownerSuggestions.length > 0 ? (
        <ul className="space-y-2 rounded-md border border-orange-500/20 bg-orange-500/5 p-4 text-sm">
          {snapshot.ownerSuggestions.map((line) => (
            <li key={line} className="text-foreground">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-border/80 bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap">
          {snapshot.digestLines.join("\n")}
        </div>
      )}

      {snapshot.suggestions.length > 0 ? (
        <Button disabled={pending} onClick={onApply}>
          Odobri preporučene thresholdove
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Trenutni thresholdovi su OK ili confidence &lt; 90%.
        </p>
      )}

      <ul className="space-y-2 text-sm text-muted-foreground">
        {snapshot.metrics.map((row) => (
          <li key={row.key}>
            <span className="font-medium text-foreground">{row.key}</span>:{" "}
            {row.currentValue}min → optimal {row.optimalValue}min · conv{" "}
            {pct(row.conversionAtCurrent)} → {pct(row.conversionAtOptimal)} · n=
            {row.sampleSize} · conf {pct(row.confidence)}
          </li>
        ))}
      </ul>

      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard/optimization">Graf konverzije po timing-u</Link>
      </Button>
    </div>
  );
}
