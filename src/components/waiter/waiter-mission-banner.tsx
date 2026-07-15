"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { MissionRow } from "@/lib/denis/missions/mission-types";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

type Props = {
  mission: MissionRow;
  onCompleted: () => void;
  labels: {
    title: string;
    cta: string;
  };
};

/** Mirrors WaiterBusTableBanner's shape exactly — same missing-UI gap, same fix pattern. */
export function WaiterMissionBanner({ mission, onCompleted, labels }: Props) {
  const [pending, startTransition] = useTransition();

  function markDone() {
    hapticLight();
    startTransition(async () => {
      const response = await fetch(
        `/api/denis-missions/${mission.id}/complete`,
        { method: "POST" }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Nije sačuvano.");
        return;
      }

      toast.success("Označeno kao rešeno.");
      onCompleted();
    });
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-red-500/40 bg-red-500/10 p-4",
        pending && "opacity-70"
      )}
    >
      <p className="text-sm font-semibold text-dash-text">{labels.title}</p>
      {mission.summary && (
        <p className="mt-1 text-sm text-dash-text-muted">{mission.summary}</p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={markDone}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-dash-accent px-4 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
      >
        {labels.cta}
      </button>
    </section>
  );
}
