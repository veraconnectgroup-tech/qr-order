"use client";

import { AlertTriangle } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { AllergenList } from "@/components/guest/allergen-badges";
import { cn } from "@/lib/utils";

export function parseIngredients(description: string | null | undefined) {
  if (!description?.trim()) return [];
  return description
    .split(/[,;·|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ProductIngredients({
  description,
  allergens,
  tags,
  className,
}: {
  description?: string | null;
  allergens?: string[] | null;
  tags?: string[] | null;
  className?: string;
}) {
  const { tUI } = useAppLocale();
  const ingredients = parseIngredients(description);
  const tagList = tags ?? [];
  const hasAllergens = (allergens?.length ?? 0) > 0;

  if (!ingredients.length && !hasAllergens && !tagList.length) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {ingredients.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {tUI("menu.ingredients")}
          </h4>
          <ul className="flex flex-wrap gap-2">
            {ingredients.map((item) => (
              <li
                key={item}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-200"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasAllergens && (
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-amber-400">
            <AlertTriangle className="size-3.5" aria-hidden />
            {tUI("menu.allergens")}
          </h4>
          <AllergenList allergens={allergens} />
        </section>
      )}

      {tagList.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            {tUI("menu.tags")}
          </h4>
          <ul className="flex flex-wrap gap-2">
            {tagList.map((item) => (
              <li
                key={item}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs capitalize text-zinc-400"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
