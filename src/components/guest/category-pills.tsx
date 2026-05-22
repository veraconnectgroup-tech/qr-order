"use client";

import { Cake, UtensilsCrossed, Wine } from "lucide-react";
import { useMenuLocale } from "@/components/guest/menu-locale-provider";
import {
  inferMenuSection,
  type MenuSection,
} from "@/lib/menu-section";

const SECTION_ICONS = {
  drinks: Wine,
  food: UtensilsCrossed,
  desserts: Cake,
} as const;

export function CategoryPills({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: Array<{
    id: string;
    name: string;
    name_en?: string | null;
    menu_section?: string | null;
  }>;
  activeCategory: string;
  onSelect: (categoryId: string) => void;
}) {
  const { tName } = useMenuLocale();

  if (categories.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => {
        const section = inferMenuSection(cat) as MenuSection;
        const Icon = SECTION_ICONS[section];

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-orange-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Icon className="size-3.5" />
            {tName(cat)}
          </button>
        );
      })}
    </div>
  );
}
