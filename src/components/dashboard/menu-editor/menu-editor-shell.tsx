"use client";

import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Pencil, Plus } from "lucide-react";
import { MenuEditorProductCard } from "@/components/dashboard/menu-editor/menu-editor-product-card";
import { MenuEditorProductForm } from "@/components/dashboard/menu-editor/menu-editor-product-form";
import { MenuEditorSortableCategory } from "@/components/dashboard/menu-editor/menu-editor-sortable-category";
import {
  CategoryScheduleFields,
} from "@/components/dashboard/category-schedule-fields";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatScheduleBadge } from "@/lib/menu/schedule";
import {
  MENU_SECTION_LABELS,
  MENU_SECTIONS,
  type MenuSection,
} from "@/lib/menu-section";
import { cn } from "@/lib/utils";
import type { MenuEditorState } from "@/hooks/use-menu-editor";

export function MenuEditorShell({ state }: { state: MenuEditorState }) {
  const {
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
  } = state;

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col gap-0 overflow-hidden rounded-xl border border-dash-border md:min-h-[520px] md:flex-row">
        <Skeleton className="h-24 rounded-none bg-dash-surface md:h-full md:w-[280px]" />
        <Skeleton className="h-full flex-1 rounded-none bg-dash-bg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-xl border border-dash-border md:min-h-[calc(100dvh-10rem)] md:flex-row">
      <div className="border-b border-dash-border bg-dash-surface/50 p-3 md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dash-text-secondary">Categories</h2>
          <button
            type="button"
            onClick={openNewCategoryDialog}
            className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-accent"
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
                  ? "bg-dash-accent text-white"
                  : "bg-dash-surface-raised text-dash-text-muted"
              )}
            >
              {category.name} ({category.productCount})
            </button>
          ))}
        </div>
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-dash-border bg-dash-surface/50 p-4 md:flex">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dash-text-secondary">Categories</h2>
          <button
            type="button"
            onClick={openNewCategoryDialog}
            className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-accent"
            aria-label="Add category"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">No categories yet.</p>
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
                  <MenuEditorSortableCategory
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

      <section className="flex min-w-0 flex-1 flex-col bg-dash-bg">
        <div className="flex flex-col gap-3 border-b border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-dash-text sm:text-lg">
              {selectedCategory?.name ?? "Select a category"}
            </h2>
            <p className="text-xs text-dash-text-disabled sm:text-sm">
              {categoryProducts.length} product
              {categoryProducts.length !== 1 ? "s" : ""}
              {selectedCategory && !selectedCategory.is_active && (
                <span className="ml-2 text-dash-accent">· Hidden from menu</span>
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
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-dash-surface-overlay px-4 py-2 text-sm font-medium text-dash-text-secondary transition hover:bg-dash-surface-raised"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-dash-accent-hover disabled:opacity-50 sm:w-auto"
            >
              <Plus className="size-4" />
              Add Product
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!selectedCategoryId ? (
            <p className="py-12 text-center text-dash-text-disabled">
              Create a category to start adding products.
            </p>
          ) : categoryProducts.length === 0 ? (
            <p className="py-12 text-center text-dash-text-disabled">
              No products in this category yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map((product) => (
                <MenuEditorProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  onToggleAvailable={(available) =>
                    toggleProductAvailable(product.id, available)
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
        <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-text">
              {editingCategoryId ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <label className="block space-y-1.5 py-2">
            <span className="text-sm text-dash-text-muted">Name</span>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Cocktails"
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            />
          </label>
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-dash-text-muted">Name (English, optional)</span>
            <input
              value={newCategoryNameEn}
              onChange={(e) => setNewCategoryNameEn(e.target.value)}
              placeholder="Cocktails"
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            />
          </label>
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-dash-text-muted">Section</span>
            <select
              value={newCategorySection}
              onChange={(e) =>
                setNewCategorySection(e.target.value as MenuSection)
              }
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            >
              {MENU_SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {MENU_SECTION_LABELS[section]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 pb-2">
            <span className="text-sm text-dash-text-muted">Printer</span>
            <select
              value={newCategoryPrinterTarget}
              onChange={(e) =>
                setNewCategoryPrinterTarget(e.target.value as "kitchen" | "bar")
              }
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            >
              <option value="kitchen">Kitchen</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <CategoryScheduleFields
            value={categorySchedule}
            onChange={setCategorySchedule}
          />
          <DialogFooter className="border-dash-border bg-transparent">
            <button
              type="button"
              onClick={() => {
                setCategoryDialogOpen(false);
                setEditingCategoryId(null);
              }}
              className="rounded-lg px-4 py-2 text-sm text-dash-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !newCategoryName.trim()}
              onClick={saveCategory}
              className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
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
        <DialogContent className="max-h-[92vh] overflow-y-auto border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-text">
              {editingProduct ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>
          <MenuEditorProductForm
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
