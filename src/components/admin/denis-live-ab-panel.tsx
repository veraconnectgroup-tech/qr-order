"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import {
  approveLiveAbWinner,
  startLiveAbExperiment,
  stopLiveAbExperiment,
} from "@/lib/admin/denis-live-ab-actions";
import type { LiveAbAdminSnapshot } from "@/lib/admin/denis-live-ab";
import { Button } from "@/components/ui/button";

export function DenisLiveAbPanel({ snapshot }: { snapshot: LiveAbAdminSnapshot }) {
  const [pending, startTransition] = useTransition();

  if (!snapshot.experiment || !snapshot.result) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-5 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold">Live A/B experiment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nema aktivnog eksperimenta. Pokreni test strategije (npr. dessert
              nudge timing).
            </p>
          </div>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const outcome = await startLiveAbExperiment({
                name: "Dessert nudge timing",
                metric: "conversion_rate",
                variantAConfig: { upsell: { dessertDelayMinutes: 8 } },
                variantBConfig: { upsell: { dessertDelayMinutes: 5 } },
              });
              if (!outcome.ok) {
                toast.error(outcome.error ?? "Start failed.");
                return;
              }
              toast.success("Eksperiment pokrenut.");
            });
          }}
        >
          Pokreni dessert timing test
        </Button>
      </div>
    );
  }

  const { experiment, result } = snapshot;
  const total = result.sessionsA + result.sessionsB;
  const target = total + result.sessionsRemaining;
  const confPct = Math.round(result.confidence * 100);
  const liftPct = Math.round(result.lift * 100);

  function onApprove() {
    startTransition(async () => {
      const outcome = await approveLiveAbWinner();
      if (!outcome.ok) {
        toast.error(outcome.error ?? "Apply failed.");
        return;
      }
      toast.success("Pobednik primenjen u konfiguraciju.");
    });
  }

  function onStop() {
    startTransition(async () => {
      const outcome = await stopLiveAbExperiment();
      if (!outcome.ok) {
        toast.error(outcome.error ?? "Stop failed.");
        return;
      }
      toast.success("Eksperiment zaustavljen.");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 text-orange-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Live A/B experiment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Denis testira strategije uživo — jedan aktivan eksperiment po lokaciji
            (M1).
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border/80 bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap">
        {`EXPERIMENT: "${experiment.name}"\n` +
          `Variant A: ${snapshot.variantALabel} (standard)\n` +
          `Variant B: ${snapshot.variantBLabel}\n` +
          `Status: ${total}/${target} sesija | B ${liftPct >= 0 ? "+" : ""}${liftPct}% ${experiment.metric.replace(/_/g, " ")} | ${confPct}% confidence\n` +
          (result.sessionsRemaining > 0
            ? `→ Još ${result.sessionsRemaining} sesije do zaključka`
            : `→ ${result.recommendation}`)}
      </div>

      <div className="flex flex-wrap gap-2">
        {snapshot.pendingOwnerApproval ? (
          <Button disabled={pending} onClick={onApprove}>
            Odobri primenu pobednika
          </Button>
        ) : null}
        <Button variant="outline" disabled={pending} onClick={onStop}>
          Zaustavi eksperiment
        </Button>
      </div>
    </div>
  );
}
