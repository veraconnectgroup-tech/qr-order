"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaiterOrderAssistResult } from "@/lib/denis/venue/copilot/waiter-copilot-types";

type Props = {
  query: string;
  cartProductIds: string[];
  onPickProduct?: (productId: string, label: string) => void;
  className?: string;
};

export function WaiterOrderAssistPanel({
  query,
  cartProductIds,
  onPickProduct,
  className,
}: Props) {
  const [result, setResult] = useState<WaiterOrderAssistResult | null>(null);
  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2 && cartProductIds.length === 0) {
      setResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/waiter/order-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: debouncedQuery,
            cartProductIds,
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        setResult(json.data as WaiterOrderAssistResult);
      } catch {
        setResult(null);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [debouncedQuery, cartProductIds]);

  const suggestions = [
    ...(result?.allergyWarnings ?? []),
    ...(result?.matches ?? []),
    ...(result?.pairings ?? []),
  ];

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-dash-accent/30 bg-dash-accent/5 p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-dash-accent">
        <Sparkles className="size-3.5" />
        Denis assist
      </div>
      <div className="space-y-1.5">
        {suggestions.slice(0, 6).map((item, index) => (
          <button
            key={`${item.kind}-${item.productId ?? item.label}-${index}`}
            type="button"
            disabled={!item.productId || item.kind === "allergy_warning"}
            onClick={() => {
              if (item.productId && onPickProduct) {
                onPickProduct(item.productId, item.label);
              }
            }}
            className={cn(
              "flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
              item.kind === "allergy_warning"
                ? "bg-orange-500/10 text-orange-200"
                : "bg-dash-bg/60 text-dash-text-secondary hover:bg-dash-surface-raised active:scale-[0.99]",
              item.productId && item.kind !== "allergy_warning" && "cursor-pointer"
            )}
          >
            <span>
              {item.kind === "pairing" ? "↗ " : item.kind === "allergy_warning" ? "⚠ " : ""}
              {item.label}
            </span>
            {item.detail ? (
              <span className="shrink-0 text-xs text-dash-text-muted">{item.detail}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
