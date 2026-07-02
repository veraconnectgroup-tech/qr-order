"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OrderTimelineEntry } from "@/lib/orders/order-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatTimelineTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function OrderTimelinePanel({
  orderId,
  className,
}: {
  orderId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<OrderTimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (entries !== null || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/timeline`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Could not load timeline.");
      }

      const body = (await response.json()) as {
        data?: { timeline?: OrderTimelineEntry[] };
      };

      setEntries(body.data?.timeline ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load timeline."
      );
    } finally {
      setLoading(false);
    }
  }, [entries, loading, orderId]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      void loadTimeline();
    }
  }

  return (
    <div className={cn("mt-2", className)}>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex min-h-12 w-full items-center justify-between rounded-lg border border-dash-border bg-dash-bg/50 px-3 py-2 text-left text-sm font-medium text-dash-text-secondary transition-colors hover:border-dash-accent/40 hover:text-dash-text"
        aria-expanded={open}
      >
        <span>Timeline</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-dash-border bg-dash-bg/40 p-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-md bg-dash-surface-raised" />
              <Skeleton className="h-10 rounded-md bg-dash-surface-raised" />
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {!loading && !error && entries?.length === 0 && (
            <p className="text-sm text-dash-text-muted">
              No timeline events recorded yet.
            </p>
          )}

          {!loading && !error && entries && entries.length > 0 && (
            <ol className="relative space-y-0 border-l border-dash-border pl-4">
              {entries.map((entry, index) => (
                <li key={`${entry.at}:${entry.kind}:${index}`} className="pb-4 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[5px] mt-1.5 size-2 rounded-full",
                      entry.denis ? "bg-[#f97316]" : "bg-dash-text-disabled"
                    )}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <time
                      className="font-mono text-xs tabular-nums text-dash-text-muted"
                      dateTime={entry.at}
                    >
                      {formatTimelineTime(entry.at)}
                    </time>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        entry.denis ? "text-[#f97316]" : "text-dash-text"
                      )}
                    >
                      {entry.label}
                    </p>
                    {entry.actor && (
                      <span className="text-xs text-dash-text-disabled">
                        · {entry.actor}
                      </span>
                    )}
                  </div>
                  {entry.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-dash-text-muted">
                      {entry.detail}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/** Test hook — lazy fetch only when `load()` is called. */
export function useLazyOrderTimeline(orderId: string) {
  const [entries, setEntries] = useState<OrderTimelineEntry[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    const response = await fetch(`/api/orders/${orderId}/timeline`);
    if (!response.ok) return;
    const body = (await response.json()) as {
      data?: { timeline?: OrderTimelineEntry[] };
    };
    setEntries(body.data?.timeline ?? []);
    setLoaded(true);
  }, [loaded, orderId]);

  return { entries, loaded, load };
}
