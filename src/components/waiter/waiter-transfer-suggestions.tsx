"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  formatTransferSuggestionHeadline,
  formatTransferSuggestionReason,
  type TransferSuggestion,
} from "@/lib/denis/intelligence/table-transfer-advisor";
import { cn } from "@/lib/utils";

function reasonLabel(reason: TransferSuggestion["reason"]): string {
  switch (reason) {
    case "group_merge":
      return "Spajanje";
    case "better_seat":
      return "Bolje mesto";
    case "capacity_rebalance":
      return "Raspored";
    case "reserved_incoming":
      return "Rezervacija";
    case "turnover_soon":
      return "Uskoro slobodan";
    case "waitlist_table_merge":
      return "Lista čekanja";
  }
}

function canExecuteTransfer(suggestion: TransferSuggestion): boolean {
  if (suggestion.fromTableId === suggestion.toTableId) return false;
  if (suggestion.reason === "waitlist_table_merge") return false;
  if (suggestion.orderIds.length === 0 && suggestion.reason !== "group_merge") {
    return false;
  }
  return true;
}

export function WaiterTransferSuggestions({ className }: { className?: string }) {
  const { locationId, aiConciergeEnabled } = useDashboard();
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!locationId || !aiConciergeEnabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/waiter/transfer-suggestions", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as { suggestions?: TransferSuggestion[] };
      setSuggestions(body.suggestions ?? []);
    } finally {
      setLoading(false);
    }
  }, [aiConciergeEnabled, locationId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  function executeTransfer(suggestion: TransferSuggestion) {
    if (!canExecuteTransfer(suggestion)) return;

    startTransition(async () => {
      const isMerge = suggestion.reason === "group_merge";
      const endpoint = isMerge ? "/api/table-sessions/merge" : "/api/table-transfers";
      const requestPayload = isMerge
        ? {
            primary_table_id: suggestion.toTableId,
            secondary_table_id: suggestion.fromTableId,
            note: suggestion.detail,
          }
        : {
            from_table_id: suggestion.fromTableId,
            to_table_id: suggestion.toTableId,
            order_ids: suggestion.orderIds,
            note: suggestion.detail,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        transferred?: number;
        to_table_name?: string;
      } | null;

      if (!response.ok) {
        toast.error(result?.error ?? "Transfer nije uspeo.");
        return;
      }

      toast.success(
        `Premešteno ${result?.transferred ?? suggestion.orderIds.length} narudžbina na sto ${result?.to_table_name ?? suggestion.toTableName}.`
      );
      await load();
    });
  }

  if (!aiConciergeEnabled) return null;

  if (loading) {
    return (
      <Skeleton className={cn("h-24 rounded-xl bg-dash-surface-raised", className)} />
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-dash-accent/25 bg-dash-accent/5 p-3",
        className
      )}
      aria-label="Denis transfer predlozi"
    >
      <div className="mb-2 flex items-center gap-2">
        <ArrowRightLeft className="size-4 text-dash-accent" aria-hidden />
        <h2 className="text-sm font-semibold text-dash-text">Denis — premeštaj</h2>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => (
          <li
            key={`${suggestion.fromTableId}:${suggestion.toTableId}:${suggestion.reason}`}
            className="rounded-lg border border-dash-border-subtle bg-dash-surface px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-dash-accent">
                  {reasonLabel(suggestion.reason)}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-dash-text">
                  {formatTransferSuggestionHeadline(suggestion)}
                </p>
                <p className="mt-1 text-xs text-dash-text-muted">
                  {formatTransferSuggestionReason(suggestion)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {canExecuteTransfer(suggestion) ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={pending}
                    onClick={() => executeTransfer(suggestion)}
                  >
                    {suggestion.reason === "group_merge" ? "Spoji" : "Prenesi"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  asChild
                >
                  <Link href={`/waiter/tables/${suggestion.fromTableId}`}>
                    Otvori
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
