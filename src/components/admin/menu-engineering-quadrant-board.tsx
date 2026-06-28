"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type {
  MenuEngineeringCategory,
  MenuItemAnalysis,
} from "@/lib/denis/platform/menu-engineering";
import { cn } from "@/lib/utils";

const QUADRANTS: MenuEngineeringCategory[] = [
  "star",
  "puzzle",
  "workhorse",
  "dog",
];

const QUADRANT_META: Record<
  MenuEngineeringCategory,
  { emoji: string; label: string; className: string }
> = {
  star: {
    emoji: "⭐",
    label: "Star",
    className: "border-amber-500/40 bg-amber-500/10",
  },
  puzzle: {
    emoji: "🧩",
    label: "Puzzle",
    className: "border-violet-500/40 bg-violet-500/10",
  },
  workhorse: {
    emoji: "🐂",
    label: "Workhorse",
    className: "border-sky-500/40 bg-sky-500/10",
  },
  dog: {
    emoji: "🐕",
    label: "Dog",
    className: "border-zinc-500/40 bg-zinc-500/10",
  },
};

function DraggableItem({ item }: { item: MenuItemAnalysis }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.productId,
      data: { item },
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "w-full rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs shadow-sm transition-opacity",
        isDragging && "opacity-40"
      )}
    >
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {item.orderCount} nar · €{item.price.toFixed(0)}
      </p>
    </button>
  );
}

function QuadrantColumn({
  category,
  items,
}: {
  category: MenuEngineeringCategory;
  items: MenuItemAnalysis[];
}) {
  const meta = QUADRANT_META[category];
  const { setNodeRef, isOver } = useDroppable({ id: category });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-48 rounded-xl border p-3 transition-colors",
        meta.className,
        isOver && "ring-2 ring-dash-accent/50"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {meta.emoji} {meta.label}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {items.length} stavki
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <DraggableItem key={item.productId} item={item} />
        ))}
      </div>
    </div>
  );
}

export function MenuEngineeringQuadrantBoard({
  items,
}: {
  items: MenuItemAnalysis[];
}) {
  const [assignments, setAssignments] = useState<Record<string, MenuEngineeringCategory>>(
    () =>
      Object.fromEntries(
        items.map((item) => [item.productId, item.category])
      ) as Record<string, MenuEngineeringCategory>
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byCategory = useMemo(() => {
    const grouped: Record<MenuEngineeringCategory, MenuItemAnalysis[]> = {
      star: [],
      puzzle: [],
      workhorse: [],
      dog: [],
    };
    for (const item of items) {
      const category = assignments[item.productId] ?? item.category;
      grouped[category].push({ ...item, category });
    }
    return grouped;
  }, [assignments, items]);

  const activeItem = activeId
    ? items.find((item) => item.productId === activeId) ?? null
    : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const target = event.over?.id;
    const productId = String(event.active.id);
    if (!target || !QUADRANTS.includes(target as MenuEngineeringCategory)) {
      return;
    }
    setAssignments((current) => ({
      ...current,
      [productId]: target as MenuEngineeringCategory,
    }));
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {QUADRANTS.map((category) => (
          <QuadrantColumn
            key={category}
            category={category}
            items={byCategory[category]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-lg">
            <p className="font-medium">{activeItem.name}</p>
          </div>
        ) : null}
      </DragOverlay>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Prevucite stavke između kvadranata za what-if planiranje (lokalno, ne menja VKG).
      </p>
    </DndContext>
  );
}
