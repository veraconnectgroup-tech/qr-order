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
import { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";
import { sanitizeText } from "@/lib/security/sanitize";
import { formatPrice } from "@/lib/format";
import {
  CategoryScheduleFields,
  categoryScheduleFromRow,
  defaultCategoryScheduleState,
  type CategoryScheduleFormState,
} from "@/components/dashboard/category-schedule-fields";
import {
  EU_ALLERGENS,
  normalizeAllergenId,
  type AllergenId,
} from "@/lib/allergens";
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
import {
  formatScheduleBadge,
  normalizeScheduleDays,
} from "@/lib/menu/schedule";
import { cn } from "@/lib/utils";
import { ProductImageUpload } from "@/components/dashboard/product-image-upload";
import {
  DEFAULT_SERVE_SIZE_PRESETS,
  parseServeSizePresets,
} from "@/lib/serve-size";
import {
  MENU_SECTION_LABELS,
  MENU_SECTIONS,
  type MenuSection,
} from "@/lib/menu-section";
import { LOCALE_LABELS, type MenuLocale } from "@/lib/i18n/translations";
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
        !product.is_available && "border-zinc-700 bg-zinc-800/80 opacity-80"
      )}
    >
      <div className="relative h-[140px] w-full">
        {!product.is_available && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Unavailable
          </span>
        )}
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
        <span className="text-xs font-medium text-zinc-400">
          {product.is_available ? "In stock" : "Out of stock"}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={product.is_available}
            onCheckedChange={onToggleAvailable}
            aria-label={
              product.is_available
                ? `Mark ${product.name} as unavailable`
                : `Mark ${product.name} as available`
            }
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
        {formatScheduleBadge(category) && (
          <p className="mt-0.5 text-[10px] leading-tight text-amber-400/90">
            {formatScheduleBadge(category)}
          </p>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
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

function ProductForm({
  initial,
  currency,
  orgId,
  menuLocale,
  categoryMenuSection,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<Product>;
  currency: string;
  orgId: string;
  menuLocale: MenuLocale;
  categoryMenuSection: MenuSection;
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
    requires_serve_size: boolean;
    serve_size_presets: string[] | null;
    allow_custom_serve_size: boolean;
    tax_rate: number | null;
    ai_description: string;
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
  const [aiDescription, setAiDescription] = useState(
    initial?.ai_description ?? ""
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
  const [allergens, setAllergens] = useState<Set<AllergenId>>(() => {
    const ids = new Set<AllergenId>();
    for (const raw of initial?.allergens ?? []) {
      const id = normalizeAllergenId(raw);
      if (id) ids.add(id);
    }
    return ids;
  });
  const [requiresServeSize, setRequiresServeSize] = useState(
    initial?.requires_serve_size ?? false
  );
  const [serveSizePresetsText, setServeSizePresetsText] = useState(
    initial?.serve_size_presets?.join(", ") ??
      DEFAULT_SERVE_SIZE_PRESETS.join(", ")
  );
  const [allowCustomServeSize, setAllowCustomServeSize] = useState(
    initial?.allow_custom_serve_size ?? true
  );
  const isDrinksCategory = categoryMenuSection === "drinks";
  const initialTaxSetting =
    initial?.tax_rate == null
      ? "default"
      : Number(initial.tax_rate) === 7
        ? "7"
        : "19";
  const [taxSetting, setTaxSetting] = useState<"default" | "7" | "19">(
    isDrinksCategory ? "19" : initialTaxSetting
  );

  const taxRateValue: number | null =
    taxSetting === "default" ? null : taxSetting === "7" ? 7 : 19;
  const primaryLang = LOCALE_LABELS[menuLocale];

  return (
    <div className="space-y-4 py-2">
      <ProductImageUpload
        orgId={orgId}
        value={imageUrl}
        onChange={setImageUrl}
        disabled={saving}
      />

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Name ({primaryLang})</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Name (English)</span>
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="Aperol Spritz"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">
          Ingredients ({primaryLang}, comma-separated)
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
          Ingredients (English, optional)
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
        <span className="text-sm text-zinc-400">AI Beschreibung</span>
        <textarea
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          rows={3}
          placeholder="Beschreiben Sie Zubereitung, Zutaten, Empfehlungen fuer den AI Concierge"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
      </label>
      <div className="space-y-2">
        <span className="text-sm text-zinc-400">Allergens (EU 14)</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EU_ALLERGENS.map((allergen) => {
            const checked = allergens.has(allergen.id);
            return (
              <label
                key={allergen.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setAllergens((prev) => {
                      const next = new Set(prev);
                      if (next.has(allergen.id)) next.delete(allergen.id);
                      else next.add(allergen.id);
                      return next;
                    });
                  }}
                  className="size-4 rounded border-zinc-600"
                />
                <span aria-hidden>{allergen.emoji}</span>
                <span>{allergen.label}</span>
              </label>
            );
          })}
        </div>
      </div>
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
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">MwSt-Satz</span>
        <select
          value={isDrinksCategory ? "19" : taxSetting}
          onChange={(e) =>
            setTaxSetting(e.target.value as "default" | "7" | "19")
          }
          disabled={isDrinksCategory}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="default">Org default (19%)</option>
          <option value="7">Ermäßigt (7%)</option>
          <option value="19">Standard (19%)</option>
        </select>
        {isDrinksCategory && (
          <p className="text-xs text-zinc-500">
            Drinks are always taxed at 19%.
          </p>
        )}
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
        Available on guest menu
      </label>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <Switch
            checked={requiresServeSize}
            onCheckedChange={setRequiresServeSize}
          />
          Ask for serve size (drinks)
        </label>
        {requiresServeSize && (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">
                Preset sizes in liters (comma-separated)
              </span>
              <input
                value={serveSizePresetsText}
                onChange={(e) => setServeSizePresetsText(e.target.value)}
                placeholder="0.2, 0.3, 0.5"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <Switch
                checked={allowCustomServeSize}
                onCheckedChange={setAllowCustomServeSize}
              />
              Allow custom size entry
            </label>
          </>
        )}
      </div>

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
              allergens:
                allergens.size > 0 ? [...allergens] : null,
              requires_serve_size: requiresServeSize,
              serve_size_presets: requiresServeSize
                ? parseServeSizePresets(serveSizePresetsText)
                : null,
              allow_custom_serve_size: allowCustomServeSize,
              tax_rate: taxRateValue,
              ai_description: aiDescription.trim(),
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
  const { locationId, orgId, currency, menuLocale } = useDashboard();
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
  const [newCategorySection, setNewCategorySection] =
    useState<MenuSection>("food");
  const [newCategoryPrinterTarget, setNewCategoryPrinterTarget] = useState<
    "kitchen" | "bar"
  >("kitchen");
  const [categorySchedule, setCategorySchedule] =
    useState<CategoryScheduleFormState>(() => defaultCategoryScheduleState());
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
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
          .is("deleted_at", null)
          .order("sort_order"),
        supabase
          .from("products")
          .select("*")
          .eq("location_id", locationId)
          .is("deleted_at", null)
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
    const results = await Promise.all(
      reordered.map((cat, index) =>
        supabase
          .from("categories")
          .update({ sort_order: index })
          .eq("id", cat.id)
      )
    );
    if (results.some((result) => result.error)) {
      toast.error("Could not update category order");
      void load();
      return;
    }
    toast.success("Category order updated");
  }

  function openNewCategoryDialog() {
    setEditingCategoryId(null);
    setNewCategoryName("");
    setNewCategoryNameEn("");
    setNewCategorySection("food");
    setNewCategoryPrinterTarget("kitchen");
    setCategorySchedule(defaultCategoryScheduleState());
    setCategoryDialogOpen(true);
  }

  function openEditCategoryDialog(category: CategoryRow) {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryNameEn(category.name_en ?? "");
    setNewCategorySection((category.menu_section as MenuSection) ?? "food");
    setNewCategoryPrinterTarget(
      category.printer_target === "bar" ? "bar" : "kitchen"
    );
    setCategorySchedule(categoryScheduleFromRow(category));
    setCategoryDialogOpen(true);
  }

  function schedulePayload(schedule: CategoryScheduleFormState) {
    if (!schedule.schedule_enabled) {
      return {
        schedule_enabled: false,
        schedule_start: null,
        schedule_end: null,
        schedule_days: normalizeScheduleDays([1, 2, 3, 4, 5, 6, 0]),
      };
    }

    return {
      schedule_enabled: true,
      schedule_start: schedule.schedule_start,
      schedule_end: schedule.schedule_end,
      schedule_days: normalizeScheduleDays(schedule.schedule_days),
    };
  }

  async function saveCategory() {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: sanitizeText(newCategoryName, 200),
      name_en: newCategoryNameEn.trim()
        ? sanitizeText(newCategoryNameEn, 200)
        : null,
      menu_section: newCategorySection,
      printer_target: newCategoryPrinterTarget,
      ...schedulePayload(categorySchedule),
    };

    if (editingCategoryId) {
      const { error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editingCategoryId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Category updated");
    } else {
      const { error } = await supabase.from("categories").insert({
        location_id: locationId,
        ...payload,
        sort_order: categories.length,
        is_active: true,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Category added");
    }

    setCategoryDialogOpen(false);
    setEditingCategoryId(null);
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
    requires_serve_size: boolean;
    serve_size_presets: string[] | null;
    allow_custom_serve_size: boolean;
    tax_rate: number | null;
    ai_description: string;
  }) {
    if (!selectedCategoryId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: sanitizeText(values.name, 200),
      name_en: values.name_en ? sanitizeText(values.name_en, 200) : null,
      description: values.description
        ? sanitizeText(values.description, 5000)
        : null,
      description_en: values.description_en
        ? sanitizeText(values.description_en, 5000)
        : null,
      price: values.price,
      prep_time_minutes: values.prep_time_minutes,
      is_available: values.is_available,
      image_url: values.image_url,
      allergens: values.allergens,
      requires_serve_size: values.requires_serve_size,
      serve_size_presets: values.serve_size_presets,
      allow_custom_serve_size: values.allow_custom_serve_size,
      tax_rate: values.tax_rate,
      ai_description: values.ai_description
        ? sanitizeText(values.ai_description, 2000)
        : null,
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
      void invalidateMenuCache(locationId);
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
      void invalidateMenuCache(locationId);
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
            onClick={openNewCategoryDialog}
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
            onClick={openNewCategoryDialog}
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
                    onEdit={() => openEditCategoryDialog(category)}
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
              {selectedCategory && formatScheduleBadge(selectedCategory) && (
                <span className="ml-2 text-amber-400">
                  · {formatScheduleBadge(selectedCategory)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedCategory && (
              <button
                type="button"
                onClick={() => openEditCategoryDialog(selectedCategory)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <Pencil className="size-4" />
                Edit Category
              </button>
            )}
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
            <DialogTitle className="text-zinc-50">
              {editingCategoryId ? "Edit Category" : "New Category"}
            </DialogTitle>
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
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-zinc-400">Section</span>
            <select
              value={newCategorySection}
              onChange={(e) =>
                setNewCategorySection(e.target.value as MenuSection)
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            >
              {MENU_SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {MENU_SECTION_LABELS[section]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-zinc-400">Printer</span>
            <select
              value={newCategoryPrinterTarget}
              onChange={(e) =>
                setNewCategoryPrinterTarget(e.target.value as "kitchen" | "bar")
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            >
              <option value="kitchen">Kitchen</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <CategoryScheduleFields
            value={categorySchedule}
            onChange={setCategorySchedule}
          />
          <DialogFooter className="border-zinc-800 bg-transparent">
            <button
              type="button"
              onClick={() => {
                setCategoryDialogOpen(false);
                setEditingCategoryId(null);
              }}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !newCategoryName.trim()}
              onClick={saveCategory}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : editingCategoryId ? "Save" : "Add Category"}
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
            menuLocale={menuLocale}
            categoryMenuSection={
              (selectedCategory?.menu_section as MenuSection) ?? "food"
            }
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
