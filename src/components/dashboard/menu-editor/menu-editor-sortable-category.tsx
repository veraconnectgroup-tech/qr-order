"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import type { CategoryRow } from "@/components/dashboard/menu-editor/types";
import { Switch } from "@/components/ui/switch";
import { formatScheduleBadge } from "@/lib/menu/schedule";
import { cn } from "@/lib/utils";

export function MenuEditorSortableCategory({
  category,
  selected,
  onSelect,
  onToggleActive,
  onEdit,
}: {
  category: CategoryRow;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 transition",
        selected
          ? "border-l-2 border-dash-accent bg-dash-surface-raised/80 pl-[6px]"
          : "border-l-2 border-transparent hover:bg-dash-surface-raised/40",
        isDragging && "opacity-60"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-dash-text-disabled active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium text-dash-text">
          {category.name}
        </p>
        <p className="text-xs text-dash-text-disabled">
          {category.productCount} items
        </p>
        {formatScheduleBadge(category) && (
          <p className="mt-0.5 text-[10px] leading-tight text-amber-400/90">
            {formatScheduleBadge(category)}
          </p>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-1.5 text-dash-text-disabled transition hover:bg-dash-surface-raised hover:text-dash-text-secondary"
        aria-label={`Edit ${category.name}`}
      >
        <Pencil className="size-3.5" />
      </button>
      <Switch
        checked={category.is_active}
        onCheckedChange={onToggleActive}
        aria-label={`Toggle ${category.name}`}
        className="scale-75"
      />
    </div>
  );
}
