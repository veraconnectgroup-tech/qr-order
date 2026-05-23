"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { ModifierGroupEditor } from "@/components/admin/modifier-group-editor";
import {
  ProductAllergenBadges,
  ProductEditDialog,
  ProductThumbnail,
} from "@/components/admin/product-edit-dialog";
import {
  bulkDeleteProducts,
  bulkToggleAvailability,
  createProduct,
  toggleProductAvailability,
} from "@/lib/admin/actions";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category, Modifier, ModifierGroup, Product } from "@/types";

type ProductWithModifierGroups = Product & {
  modifier_groups: (ModifierGroup & { modifiers: Modifier[] })[];
};

export type { ProductWithModifierGroups };

export function MenuManager({
  products,
  categories,
  currency,
}: {
  products: ProductWithModifierGroups[];
  categories: Category[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithModifierGroups | null>(null);

  const allSelected =
    products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0;

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    if (categoryId) formData.set("category_id", categoryId);
    formData.set("is_available", isAvailable ? "true" : "false");
    const result = await createProduct(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setCategoryId("");
  }

  function toggleProductExpand(productId: string) {
    setExpandedProductId((current) =>
      current === productId ? null : productId
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  async function runBulk(
    action: () => Promise<{ error?: string; success?: boolean } | undefined>
  ) {
    setBulkPending(true);
    const result = await action();
    setBulkPending(false);
    if (result?.error) {
      alert(result.error);
      return;
    }
    setSelectedIds(new Set());
  }

  async function handleBulkOutOfStock() {
    await runBulk(() => bulkToggleAvailability(selectedList, false));
  }

  async function handleBulkInStock() {
    await runBulk(() => bulkToggleAvailability(selectedList, true));
  }

  async function handleBulkDelete() {
    if (
      !confirm(
        `Delete ${selectedList.length} product${selectedList.length === 1 ? "" : "s"}?`
      )
    ) {
      return;
    }
    await runBulk(() => bulkDeleteProducts(selectedList));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu management</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Add product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New product</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="price">Price ({currency})</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prep_time_minutes">Vreme pripreme (min)</Label>
                <Input
                  id="prep_time_minutes"
                  name="prep_time_minutes"
                  type="number"
                  min="1"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_available"
                  checked={isAvailable}
                  onCheckedChange={setIsAvailable}
                />
                <Label htmlFor="is_available">Available</Label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Saving..." : "Save product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {someSelected && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkPending}
            onClick={() => void handleBulkInStock()}
          >
            In stock
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkPending}
            onClick={() => void handleBulkOutOfStock()}
          >
            Out of stock
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkPending}
            onClick={() => void handleBulkDelete()}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {!products.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">Your menu is empty.</p>
          <p className="mt-1 text-sm text-neutral-400">
            Add your first product so guests can order.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="w-10 px-2 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all products"
                  />
                </th>
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Modifiers</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const expanded = expandedProductId === product.id;
                const groupCount = product.modifier_groups.length;
                const modifierCount = product.modifier_groups.reduce(
                  (sum, group) => sum + group.modifiers.length,
                  0
                );
                const checked = selectedIds.has(product.id);

                return (
                  <Fragment key={product.id}>
                    <tr className="border-b">
                      <td className="px-2 py-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelect(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                          onClick={() => toggleProductExpand(product.id)}
                          aria-expanded={expanded}
                          aria-label={
                            expanded ? "Hide modifiers" : "Show modifiers"
                          }
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              !expanded && "-rotate-90"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <ProductThumbnail
                            imageUrl={product.image_url}
                            name={product.name}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="line-clamp-1 text-neutral-500">
                                {product.description}
                              </p>
                            )}
                            <ProductAllergenBadges
                              allergens={product.allergens}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatPrice(Number(product.price), currency)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {groupCount > 0
                          ? `${groupCount} group${groupCount === 1 ? "" : "s"}, ${modifierCount} option${modifierCount === 1 ? "" : "s"}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            product.is_available ? "default" : "secondary"
                          }
                        >
                          {product.is_available ? "On" : "Off"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingProduct(product)}
                          >
                            <Pencil className="mr-1 size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleProductAvailability(
                                product.id,
                                !product.is_available
                              )
                            }
                          >
                            {product.is_available ? "Turn off" : "Turn on"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b last:border-0">
                        <td colSpan={7} className="p-0">
                          <ModifierGroupEditor
                            productId={product.id}
                            productName={product.name}
                            groups={product.modifier_groups}
                            currency={currency}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProductEditDialog
        product={editingProduct}
        categories={categories}
        currency={currency}
        open={Boolean(editingProduct)}
        onOpenChange={(next) => {
          if (!next) setEditingProduct(null);
        }}
      />
    </div>
  );
}
