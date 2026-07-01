"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";
import { invalidateGuestMenuCacheForLocation } from "@/lib/pwa/menu-cache";
import { sanitizeText } from "@/lib/security/sanitize";
import {
  categoryScheduleFromRow,
  defaultCategoryScheduleState,
  type CategoryScheduleFormState,
} from "@/components/dashboard/category-schedule-fields";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { CategoryRow } from "@/components/dashboard/menu-editor/types";
import { normalizeScheduleDays } from "@/lib/menu/schedule";
import type { MenuSection } from "@/lib/menu-section";
import type { Category, Product } from "@/types";

export function useMenuEditor() {
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
      invalidateGuestMenuCacheForLocation(locationId);
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
      invalidateGuestMenuCacheForLocation(locationId);
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


  return {
    locationId,
    orgId,
    currency,
    menuLocale,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    loading,
    categoryDialogOpen,
    setCategoryDialogOpen,
    productDialogOpen,
    setProductDialogOpen,
    editingProduct,
    setEditingProduct,
    newCategoryName,
    setNewCategoryName,
    newCategoryNameEn,
    setNewCategoryNameEn,
    newCategorySection,
    setNewCategorySection,
    newCategoryPrinterTarget,
    setNewCategoryPrinterTarget,
    categorySchedule,
    setCategorySchedule,
    editingCategoryId,
    setEditingCategoryId,
    saving,
    sensors,
    selectedCategory,
    categoryProducts,
    handleCategoryDragEnd,
    openNewCategoryDialog,
    openEditCategoryDialog,
    saveCategory,
    toggleCategoryActive,
    saveProduct,
    toggleProductAvailable,
  };
}

export type MenuEditorState = ReturnType<typeof useMenuEditor>;
