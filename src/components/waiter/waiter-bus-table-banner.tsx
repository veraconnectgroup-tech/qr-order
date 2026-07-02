"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { minutesSincePaid } from "@/lib/denis/cognition/waiter/bus-table-obligation";
import type { TableBusObligationClientRow } from "@/hooks/use-table-bus-obligations";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

type Props = {
  obligation: TableBusObligationClientRow;
  tableName: string;
  onCompleted: () => void;
  labels: {
    title: string;
    cta: string;
    waitSuffix: string;
  };
};

export function WaiterBusTableBanner({
  obligation,
  tableName,
  onCompleted,
  labels,
}: Props) {
  const [pending, startTransition] = useTransition();
  const waitMinutes = minutesSincePaid(obligation.paid_at);

  function markBussed() {
    hapticLight();
    startTransition(async () => {
      const response = await fetch(
        `/api/table-bus-obligations/${obligation.id}/complete`,
        { method: "POST" }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Nije sačuvano.");
        return;
      }

      toast.success("Sto označen kao raspremljen.");
      onCompleted();
    });
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-500/35 bg-amber-500/10 p-4",
        pending && "opacity-70"
      )}
    >
      <p className="text-sm font-semibold text-dash-text">
        {labels.title.replace("{table}", tableName)}
      </p>
      <p className="mt-1 text-sm text-dash-text-muted">
        {waitMinutes} {labels.waitSuffix}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={markBussed}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-dash-accent px-4 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
      >
        {labels.cta}
      </button>
    </section>
  );
}
