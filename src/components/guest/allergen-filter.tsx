"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  EU_ALLERGENS,
  type AllergenId,
  parseStoredAllergenExclusions,
  serializeAllergenExclusions,
} from "@/lib/allergens";
import { cn } from "@/lib/utils";

export function allergenFilterStorageKey(slug: string, token: string) {
  return `allergen-exclusions:${slug}:${token}`;
}

export function useAllergenExclusions(storageKey: string) {
  const [excluded, setExcluded] = useState<Set<AllergenId>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setExcluded(parseStoredAllergenExclusions(localStorage.getItem(storageKey)));
    setHydrated(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<AllergenId>) => {
      setExcluded(next);
      localStorage.setItem(storageKey, serializeAllergenExclusions(next));
    },
    [storageKey]
  );

  const toggle = useCallback(
    (id: AllergenId) => {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        localStorage.setItem(storageKey, serializeAllergenExclusions(next));
        return next;
      });
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    persist(new Set());
  }, [persist]);

  return { excluded, toggle, clear, hydrated, count: excluded.size };
}

function allergenLabel(
  id: AllergenId,
  fallback: string,
  tUI: ReturnType<typeof useAppLocale>["tUI"]
) {
  const key = `allergen.${id}`;
  const translated = tUI(key);
  return translated === key ? fallback : translated;
}

export function AllergenFilter({
  excluded,
  onToggle,
  onClear,
}: {
  excluded: ReadonlySet<AllergenId>;
  onToggle: (id: AllergenId) => void;
  onClear: () => void;
}) {
  const { tUI } = useAppLocale();
  const count = excluded.size;

  return (
    <div className="border-t border-zinc-800/80 px-3 py-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {tUI("allergen.excludeTitle")}
        </p>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-orange-400 hover:text-orange-300"
          >
            {tUI("allergen.clearFilters")}
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EU_ALLERGENS.map((allergen) => {
          const active = excluded.has(allergen.id);
          return (
            <button
              key={allergen.id}
              type="button"
              onClick={() => onToggle(allergen.id)}
              aria-pressed={active}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation",
                active
                  ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <span aria-hidden>{allergen.emoji}</span>
              {allergenLabel(allergen.id, allergen.label, tUI)}
            </button>
          );
        })}
      </div>
      {count > 0 && (
        <p className="mt-2 text-xs text-orange-400/90">
          {tUI("allergen.filtersActive", { count })}
        </p>
      )}
    </div>
  );
}
