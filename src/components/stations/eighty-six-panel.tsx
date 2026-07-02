"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  loadTodayEightySixListClient,
  patchProductAvailabilityClient,
  type EightySixListItem,
} from "@/lib/products/eighty-six-client";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function EightySixPanel({
  locationId,
  station,
  className,
}: {
  locationId: string;
  station?: "kitchen" | "bar";
  className?: string;
}) {
  const [items, setItems] = useState<EightySixListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadTodayEightySixListClient({ locationId, station });
      setItems(next.filter((item) => !item.isAvailable));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load 86 list."
      );
    } finally {
      setLoading(false);
    }
  }, [locationId, station]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function restore(productId: string, productName: string) {
    setBusyProductId(productId);
    try {
      await patchProductAvailabilityClient(productId, true);
      toast.success(`${productName} ponovo dostupan`);
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore item."
      );
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-dash-border bg-dash-surface p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-dash-text">Danas 86</h2>
          <p className="text-xs text-dash-text-muted">
            Jedan tap za vraćanje na meni
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="min-h-10 rounded-lg px-2 text-xs font-medium text-orange-400 hover:bg-dash-surface-raised"
        >
          Osveži
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-dash-text-muted">Učitavam…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dash-text-muted">Ništa nije označeno danas.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-2 rounded-lg bg-dash-surface-raised px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dash-text">
                  {item.productName}
                </p>
                <p className="text-xs text-dash-text-muted">
                  {formatTime(item.eightySixedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={busyProductId === item.productId}
                onClick={() => void restore(item.productId, item.productName)}
                className="min-h-10 shrink-0 rounded-lg bg-orange-500/15 px-3 text-xs font-semibold text-orange-300 hover:bg-orange-500/25 disabled:opacity-50"
              >
                Vrati
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
