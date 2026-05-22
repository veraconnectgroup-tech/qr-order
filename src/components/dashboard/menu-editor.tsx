"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { GripVertical, Pencil, Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ProductImageUpload } from "@/components/dashboard/product-image-upload";
import type { Category, Product } from "@/types";

type CategoryRow = Category & { productCount: number };

const PRODUCT_GRADIENTS = [
  "from-orange-900/40 to-amber-900/20",
  "from-rose-900/40 to-pink-900/20",
  "from-violet-900/40 to-purple-900/20",
  "from-blue-900/40 to-cyan-900/20",
  "from-emerald-900/40 to-teal-900/20",
];

function productGradient(name: string) {
  return PRODUCT_GRADIENTS[name.charCodeAt(0) % PRODUCT_GRADIENTS.length];
}

function ProductCard({
  product,
  currency,
  onToggleAvailable,
  onEdit,
}: {
  product: Product;
  currency: string;
  onToggleAvailable: (available: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700",
        !product.is_available && "opacity-60"
      )}
    >
      <div className="relative h-[140px] w-full">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br",
              productGradient(product.name)
            )}
          >
            <UtensilsCrossed className="size-8 text-zinc-700" />
          </div>
        )}
      </div>

      <p className="px-4 pt-3 text-sm font-semibold text-white">{product.name}</p>
      {product.description && (
        <p className="mt-0.5 line-clamp-1 px-4 text-xs text-zinc-500">
          {product.description}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between px-4">
        <span className="font-mono text-sm font-semibold text-orange-500">
          {formatPrice(Number(product.price), currency)}
        </span>
        {product.prep_time_minutes != null && (
          <span className="text-xs text-zinc-600">
            Prep: {product.prep_time_minutes} min
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              product.is_available ? "bg-green-500" : "bg-red-500"
            )}
          />
          {product.is_available ? "Available" : "Unavailable"}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={product.is_available}
            onCheckedChange={onToggleAvailable}
            aria-label={`Toggle ${product.name}`}
          />
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={`Edit ${product.name}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableCategoryItem({
  category,
  selected,
  onSelect,
  onToggleActive,
}: {
  category: CategoryRow;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: (active: boolean) => void;
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
          ? "border-l-2 border-orange-500 bg-zinc-800/80 pl-[6px]"
          : "border-l-2 border-transparent hover:bg-zinc-800/40",
        isDragging && "opacity-60"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 active:cursor-grabbing"
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
        <p className="truncate text-sm font-medium text-zinc-100">
          {category.name}
        </p>
        <p className="text-xs text-zinc-500">{category.productCount} items</p>
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

function ProductForm({
  initial,
  currency,
  orgId,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<Product>;
  currency: string;
  orgId: string;
  onSubmit: (values: {
    name: string;
    name_en: string;
    description: string;
    description_en: string;
    price: number;
    prep_time_minutes: number | null;
    is_available: boolean;
    image_url: string | null;
    allergens: string[] | null;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    initial?.description_en ?? ""
  );
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : ""
  );
  const [prepTime, setPrepTime] = useState(
    initial?.prep_time_minutes != null
      ? String(initial.prep_time_minutes)
      : ""
  );
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.image_url ?? null
  );
  const [allergensText, setAllergensText] = useState(
    initial?.allergens?.join(", ") ?? ""
  );

  return (
    <div className="space-y-4 py-2">
      <ProductImageUpload
        orgId={orgId}
        value={imageUrl}
        onChange={setImageUrl}
        disabled={saving}
      />

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Name (English, optional)</span>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="Aperol Spritz"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">
          Ingredients (comma-separated)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Prosecco, Aperol, soda, orange slice"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">
          Ingredients in English (optional)
        </span>
        <textarea
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          rows={2}
          placeholder="Prosecco, Aperol, soda, orange slice"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Allergens (comma-separated)</span>
        <input
          value={allergensText}
          onChange={(e) => setAllergensText(e.target.value)}
          placeholder="gluten, dairy, sulfites"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Price ({currency})</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Prep time (minutes)</span>
        <input
          type="number"
          min="1"
          value={prepTime}
          onChange={(e) => setPrepTime(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
        Available on guest menu
      </label>
      <DialogFooter className="border-zinc-800 bg-transparent pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !name.trim() || !price}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              name_en: nameEn.trim(),
              description: description.trim(),
              description_en: descriptionEn.trim(),
              price: Number(price),
              prep_time_minutes: prepTime ? Number(prepTime) : null,
              is_available: isAvailable,
              image_url: imageUrl,
              allergens: allergensText.trim()
                ? allergensText
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean)
                : null,
            })
          }
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </div>
  );
}

export function MenuEditor() {
  const { locationId, orgId, currency } = useDashboard();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryNameEn, setNewCategoryNameEn] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: categoriesData }, { data: productsData }] =
      await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("location_id", locationId)
          .order("sort_order"),
        supabase
          .from("products")
          .select("*")
          .eq("location_id", locationId)
          .order("sort_order"),
      ]);

    const productList = (productsData as Product[]) ?? [];
    const counts = new Map<string, number>();
    for (const p of productList) {
      if (!p.category_id) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }

    const categoryRows: CategoryRow[] = (
      (categoriesData as Category[]) ?? []
    ).map((c) => ({
      ...c,
      productCount: counts.get(c.id) ?? 0,
    }));

    setCategories(categoryRows);
    setProducts(productList);
    setSelectedCategoryId((prev) => {
      if (prev && categoryRows.some((c) => c.id === prev)) return prev;
      return categoryRows[0]?.id ?? null;
    });
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const categoryProducts = useMemo(
    () =>
      products.filter((p) =>
        selectedCategoryId ? p.category_id === selectedCategoryId : false
      ),
    [products, selectedCategoryId]
  );

  async function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);

    const supabase = createClient();
    await Promise.all(
      reordered.map((cat, index) =>
        supabase
          .from("categories")
          .update({ sort_order: index })
          .eq("id", cat.id)
      )
    );
    toast.success("Category order updated");
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("categories").insert({
      location_id: locationId,
      name: newCategoryName.trim(),
      name_en: newCategoryNameEn.trim() || null,
      sort_order: categories.length,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Category added");
    setCategoryDialogOpen(false);
    setNewCategoryName("");
    setNewCategoryNameEn("");
    load();
  }

  async function toggleCategoryActive(categoryId: string, active: boolean) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, is_active: active } : c))
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ is_active: active })
      .eq("id", categoryId);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  async function saveProduct(values: {
    name: string;
    name_en: string;
    description: string;
    description_en: string;
    price: number;
    prep_time_minutes: number | null;
    is_available: boolean;
    image_url: string | null;
    allergens: string[] | null;
  }) {
    if (!selectedCategoryId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: values.name,
      name_en: values.name_en || null,
      description: values.description || null,
      description_en: values.description_en || null,
      price: values.price,
      prep_time_minutes: values.prep_time_minutes,
      is_available: values.is_available,
      image_url: values.image_url,
      allergens: values.allergens,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert({
        location_id: locationId,
        category_id: selectedCategoryId,
        ...payload,
        sort_order: categoryProducts.length,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Product added");
    }

    setProductDialogOpen(false);
    setEditingProduct(null);
    load();
  }

  async function toggleProductAvailable(productId: string, available: boolean) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, is_available: available } : p
      )
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_available: available })
      .eq("id", productId);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col gap-0 overflow-hidden rounded-xl border border-zinc-800 md:min-h-[520px] md:flex-row">
        <Skeleton className="h-24 rounded-none bg-zinc-900 md:h-full md:w-[280px]" />
        <Skeleton className="h-full flex-1 rounded-none bg-zinc-950" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 md:min-h-[calc(100dvh-10rem)] md:flex-row">
      {/* Mobile category pills */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 p-3 md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Categories</h2>
          <button
            type="button"
            onClick={() => {
              setNewCategoryName("");
              setNewCategoryNameEn("");
              setCategoryDialogOpen(true);
            }}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-orange-400"
            aria-label="Add category"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryId(category.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                category.id === selectedCategoryId
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-800 text-zinc-400"
              )}
            >
              {category.name} ({category.productCount})
            </button>
          ))}
        </div>
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/50 p-4 md:flex">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Categories</h2>
          <button
            type="button"
            onClick={() => {
              setNewCategoryName("");
              setNewCategoryNameEn("");
              setCategoryDialogOpen(true);
            }}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-orange-400"
            aria-label="Add category"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-zinc-600">No categories yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 overflow-y-auto">
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    selected={category.id === selectedCategoryId}
                    onSelect={() => setSelectedCategoryId(category.id)}
                    onToggleActive={(active) =>
                      toggleCategoryActive(category.id, active)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-50 sm:text-lg">
              {selectedCategory?.name ?? "Select a category"}
            </h2>
            <p className="text-xs text-zinc-500 sm:text-sm">
              {categoryProducts.length} product
              {categoryProducts.length !== 1 ? "s" : ""}
              {selectedCategory && !selectedCategory.is_active && (
                <span className="ml-2 text-orange-400">· Hidden from menu</span>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedCategoryId}
            onClick={() => {
              setEditingProduct(null);
              setProductDialogOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:w-auto"
          >
            <Plus className="size-4" />
            Add Product
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!selectedCategoryId ? (
            <p className="py-12 text-center text-zinc-600">
              Create a category to start adding products.
            </p>
          ) : categoryProducts.length === 0 ? (
            <p className="py-12 text-center text-zinc-600">
              No products in this category yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  onToggleAvailable={(v) =>
                    toggleProductAvailable(product.id, v)
                  }
                  onEdit={() => {
                    setEditingProduct(product);
                    setProductDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">New Category</DialogTitle>
          </DialogHeader>
          <label className="block space-y-1.5 py-2">
            <span className="text-sm text-zinc-400">Name</span>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Cocktails"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            />
          </label>
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-zinc-400">Name (English, optional)</span>
            <input
              value={newCategoryNameEn}
              onChange={(e) => setNewCategoryNameEn(e.target.value)}
              placeholder="Cocktails"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            />
          </label>
          <DialogFooter className="border-zinc-800 bg-transparent">
            <button
              type="button"
              onClick={() => setCategoryDialogOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !newCategoryName.trim()}
              onClick={addCategory}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Category"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">
              {editingProduct ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            key={editingProduct?.id ?? "new"}
            initial={editingProduct ?? undefined}
            currency={currency}
            orgId={orgId}
            saving={saving}
            onCancel={() => {
              setProductDialogOpen(false);
              setEditingProduct(null);
            }}
            onSubmit={saveProduct}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
