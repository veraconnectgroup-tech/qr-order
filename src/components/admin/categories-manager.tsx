"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "@/lib/admin/actions";
import {
  CategoryScheduleFields,
  categoryScheduleFromRow,
  defaultCategoryScheduleState,
  type CategoryScheduleFormState,
} from "@/components/dashboard/category-schedule-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatScheduleBadge,
  formatScheduleTimeRange,
  formatScheduleDays,
} from "@/lib/menu/schedule";
import {
  MENU_SECTION_LABELS,
  type MenuSection,
} from "@/lib/menu-section";
import type { Category } from "@/types";

export type CategoryRow = Category & { productCount: number };

function scheduleSummary(category: Category): string | null {
  if (!category.schedule_enabled) return null;
  const range = formatScheduleTimeRange(
    category.schedule_start,
    category.schedule_end
  );
  if (!range) return null;
  return `Available ${formatScheduleDays(category.schedule_days)} ${range}`;
}

function SortableCategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const section = (category.menu_section as MenuSection) ?? "food";
  const scheduleBadge = formatScheduleBadge(category);
  const summary = scheduleSummary(category);

  return (
    <tr ref={setNodeRef} style={style} className="border-b last:border-0">
      <td className="px-2 py-3">
        <button
          type="button"
          className="cursor-grab touch-none text-neutral-400 hover:text-neutral-600"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium">{category.name}</td>
      <td className="px-4 py-3 text-neutral-600">
        {category.name_en || "—"}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline">{MENU_SECTION_LABELS[section]}</Badge>
      </td>
      <td className="max-w-xs px-4 py-3 text-neutral-600">
        {scheduleBadge ? (
          <span title={summary ?? undefined}>{scheduleBadge}</span>
        ) : (
          "Always"
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            category.is_active ? "text-green-600" : "text-neutral-400"
          }
        >
          {category.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CategoryForm({
  category,
  onSubmit,
  pending,
  error,
}: {
  category?: CategoryRow;
  onSubmit: (formData: FormData) => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  const [menuSection, setMenuSection] = useState<MenuSection>("food");
  const [schedule, setSchedule] = useState<CategoryScheduleFormState>(() =>
    defaultCategoryScheduleState()
  );

  useEffect(() => {
    if (!category) {
      setMenuSection("food");
      setSchedule(defaultCategoryScheduleState());
      return;
    }
    setMenuSection((category.menu_section as MenuSection) ?? "food");
    setSchedule(categoryScheduleFromRow(category));
  }, [category]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("menu_section", menuSection);
    fd.set("schedule_enabled", schedule.schedule_enabled ? "true" : "false");
    fd.set("schedule_start", schedule.schedule_start);
    fd.set("schedule_end", schedule.schedule_end);
    fd.set("schedule_days", JSON.stringify(schedule.schedule_days));
    await onSubmit(fd);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={category?.name ?? ""}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="name_en">Name (English)</Label>
        <Input
          id="name_en"
          name="name_en"
          defaultValue={category?.name_en ?? ""}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={category?.description ?? ""}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="mb-2 block">Menu section</Label>
        <div className="flex flex-wrap gap-3">
          {(["food", "drinks"] as const).map((section) => (
            <label
              key={section}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="menu_section_ui"
                checked={menuSection === section}
                onChange={() => setMenuSection(section)}
              />
              {MENU_SECTION_LABELS[section]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Drinks use 19% VAT. Food can use reduced 7% for takeaway.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 p-1">
        <CategoryScheduleFields value={schedule} onChange={setSchedule} />
      </div>

      {schedule.schedule_enabled && (
        <p className="text-sm text-neutral-600">
          {formatScheduleBadge({
            schedule_enabled: true,
            schedule_start: schedule.schedule_start,
            schedule_end: schedule.schedule_end,
            schedule_days: schedule.schedule_days,
          })?.replace("⏰ ", "Preview: Available ")}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : category ? "Save changes" : "Save"}
      </Button>
    </form>
  );
}

export function CategoriesManager({
  categories: initialCategories,
}: {
  categories: CategoryRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createCategory(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setCreateOpen(false);
  }

  async function handleUpdate(formData: FormData) {
    if (!editCategory) return;
    setPending(true);
    setError(null);
    const result = await updateCategory(editCategory.id, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditCategory(null);
  }

  async function handleDelete(category: CategoryRow) {
    const count = category.productCount;
    const message =
      count > 0
        ? `Delete "${category.name}"? It has ${count} product${count === 1 ? "" : "s"}. Products will remain but lose this category.`
        : `Delete "${category.name}"?`;
    if (!confirm(message)) return;
    await deleteCategory(category.id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    await reorderCategories(reordered.map((c) => c.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Add category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New category</DialogTitle>
            </DialogHeader>
            <CategoryForm
              onSubmit={handleCreate}
              pending={pending}
              error={error}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!categories.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">No categories yet.</p>
          <p className="mt-1 text-sm text-neutral-400">
            Add your first category to organize the menu.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-50 text-left">
                <tr>
                  <th className="w-10 px-2 py-3" />
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Name (EN)</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {categories.map((cat) => (
                    <SortableCategoryRow
                      key={cat.id}
                      category={cat}
                      onEdit={() => {
                        setError(null);
                        setEditCategory(cat);
                      }}
                      onDelete={() => void handleDelete(cat)}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      <Dialog
        open={Boolean(editCategory)}
        onOpenChange={(open) => {
          if (!open) setEditCategory(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editCategory && (
            <CategoryForm
              category={editCategory}
              onSubmit={handleUpdate}
              pending={pending}
              error={error}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
