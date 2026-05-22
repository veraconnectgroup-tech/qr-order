"use client";

import { useMenuLocale } from "@/components/guest/menu-locale-provider";

export function CategoryPills({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: Array<{ id: string; name: string; name_en?: string | null }>;
  activeCategory: string;
  onSelect: (categoryId: string) => void;
}) {
  const { tName } = useMenuLocale();

  if (categories.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === cat.id
              ? "bg-orange-500 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {tName(cat)}
        </button>
      ))}
    </div>
  );
}
