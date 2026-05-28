"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  resolveProductAllergens,
  type ResolvedAllergen,
} from "@/lib/allergens";
import { cn } from "@/lib/utils";

function labelFor(
  allergen: ResolvedAllergen,
  tUI: ReturnType<typeof useAppLocale>["tUI"]
) {
  if (allergen.id) {
    const key = `allergen.${allergen.id}`;
    const translated = tUI(key);
    return translated === key ? allergen.label : translated;
  }
  return allergen.label;
}

export function AllergenBadges({
  allergens,
  className,
  size = "sm",
}: {
  allergens?: string[] | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const { tUI } = useAppLocale();
  const resolved = resolveProductAllergens(allergens);
  if (resolved.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      aria-label={tUI("menu.allergens")}
    >
      {resolved.map((allergen) => (
        <span
          key={`${allergen.id ?? allergen.raw}`}
          title={labelFor(allergen, tUI)}
          className={cn(
            "inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-200",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
          )}
        >
          <span>{labelFor(allergen, tUI)}</span>
        </span>
      ))}
    </div>
  );
}

export function AllergenList({
  allergens,
  className,
}: {
  allergens?: string[] | null;
  className?: string;
}) {
  const { tUI } = useAppLocale();
  const resolved = resolveProductAllergens(allergens);
  if (resolved.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {resolved.map((allergen) => (
        <li
          key={`${allergen.id ?? allergen.raw}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200"
        >
          <span>{labelFor(allergen, tUI)}</span>
        </li>
      ))}
    </ul>
  );
}
