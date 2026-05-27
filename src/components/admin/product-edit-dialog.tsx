"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  deleteProduct,
  updateProduct,
  uploadProductImage,
} from "@/lib/admin/actions";
import {
  EU_ALLERGENS,
  productAllergenIds,
  type AllergenId,
} from "@/lib/allergens";
import { inferMenuSection } from "@/lib/menu-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { Category, Product } from "@/types";

type TaxSetting = "default" | "7" | "19";

function taxSettingFromRate(rate: number | null | undefined): TaxSetting {
  if (rate == null) return "default";
  if (Number(rate) === 7) return "7";
  if (Number(rate) === 19) return "19";
  return "default";
}

function taxRateFromSetting(setting: TaxSetting): number | null {
  if (setting === "7") return 7;
  if (setting === "19") return 19;
  return null;
}

export function ProductEditDialog({
  product,
  categories,
  currency,
  open,
  onOpenChange,
}: {
  product: Product | null;
  categories: Category[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [prepTime, setPrepTime] = useState("");
  const [taxSetting, setTaxSetting] = useState<TaxSetting>("default");
  const [allergens, setAllergens] = useState<Set<AllergenId>>(new Set());
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isDrinksCategory =
    selectedCategory != null &&
    inferMenuSection(selectedCategory) === "drinks";

  useEffect(() => {
    if (!product || !open) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(String(Number(product.price)));
    setCategoryId(product.category_id ?? "");
    setPrepTime(
      product.prep_time_minutes != null
        ? String(product.prep_time_minutes)
        : ""
    );
    setTaxSetting(taxSettingFromRate(product.tax_rate));
    setAllergens(new Set(productAllergenIds(product.allergens)));
    setIsAvailable(product.is_available);
    setImageUrl(product.image_url);
    setError(null);
  }, [product, open]);

  useEffect(() => {
    if (isDrinksCategory) setTaxSetting("19");
  }, [isDrinksCategory]);

  async function handleImageFile(file: File) {
    if (!product) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadProductImage(product.id, fd);
    setUploading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if ("url" in result && result.url) setImageUrl(result.url);
  }

  async function handleSave() {
    if (!product) return;
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    fd.set("price", price);
    fd.set("category_id", categoryId || "");
    fd.set("prep_time_minutes", prepTime || "");
    fd.set("tax_rate", String(taxRateFromSetting(taxSetting) ?? ""));
    fd.set("is_available", isAvailable ? "true" : "false");
    fd.set("allergens", JSON.stringify([...allergens]));
    fd.set("image_url", imageUrl ?? "");

    const result = await updateProduct(product.id, fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!product) return;
    if (
      !confirm(
        `Delete "${product.name}"? This removes the product and its modifier groups.`
      )
    ) {
      return;
    }
    setPending(true);
    const result = await deleteProduct(product.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  function toggleAllergen(id: AllergenId) {
    setAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-dashed bg-muted/30 transition",
              dragOver ? "border-blue-500 bg-blue-50/50" : "border-border"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleImageFile(file);
            }}
          >
            {imageUrl ? (
              <div className="relative mx-auto size-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="size-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-card/90 p-1.5 text-muted-foreground shadow hover:text-red-600"
                  onClick={() => setImageUrl(null)}
                  aria-label="Remove image"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImagePlus className="size-8 text-muted-foreground/70" />
                <p className="text-xs">Drag & drop or upload image</p>
              </div>
            )}
            <div className="border-t border-border p-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Upload photo"
                )}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                JPG, PNG or WebP · max 2 MB
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-price">Price ({currency})</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-prep">Prep time (min)</Label>
              <Input
                id="edit-prep"
                type="number"
                min="1"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="mt-1"
              />
            </div>
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
            <Label>Tax rate</Label>
            <Select
              value={isDrinksCategory ? "19" : taxSetting}
              onValueChange={(v) => setTaxSetting(v as TaxSetting)}
              disabled={isDrinksCategory}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Org default (19%)</SelectItem>
                <SelectItem value="7">Reduced (7%)</SelectItem>
                <SelectItem value="19">Standard (19%)</SelectItem>
              </SelectContent>
            </Select>
            {isDrinksCategory && (
              <p className="mt-1 text-xs text-muted-foreground">
                Drinks categories are always taxed at 19%.
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Allergens</Label>
            <div className="flex flex-wrap gap-2">
              {EU_ALLERGENS.map((allergen) => {
                const active = allergens.has(allergen.id);
                return (
                  <button
                    key={allergen.id}
                    type="button"
                    onClick={() => toggleAllergen(allergen.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-orange-300 bg-orange-50 text-orange-800"
                        : "border-border bg-card text-muted-foreground hover:border-border"
                    )}
                  >
                    <span aria-hidden>{allergen.emoji}</span> {allergen.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="edit-available"
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
            />
            <Label htmlFor="edit-available">Available on menu</Label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={pending}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={pending || !name.trim() || !price}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductAllergenBadges({
  allergens,
}: {
  allergens: string[] | null | undefined;
}) {
  const ids = productAllergenIds(allergens);
  if (!ids.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {ids.map((id) => {
        const meta = EU_ALLERGENS.find((a) => a.id === id);
        if (!meta) return null;
        return (
          <Badge key={id} variant="outline" className="text-[10px] font-normal">
            {meta.emoji} {meta.label}
          </Badge>
        );
      })}
    </div>
  );
}

export function ProductThumbnail({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="size-10 shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/50 text-xs font-medium text-muted-foreground/70">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
