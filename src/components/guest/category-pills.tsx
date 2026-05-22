"use client";

export function CategoryPills({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: Array<{ id: string; name: string }>;
  activeCategory: string;
  onSelect: (categoryId: string) => void;
}) {
  if (categories.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === cat.id
              ? "bg-orange-500 text-white"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
