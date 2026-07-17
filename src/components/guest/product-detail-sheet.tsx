"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/guest/add-to-cart-button";
import { ProductIngredients } from "@/components/guest/product-ingredients";
import { QuantitySelector } from "@/components/guest/quantity-selector";
import { ServeSizeSelector } from "@/components/guest/serve-size-selector";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidServeSize,
  productHasServeSize,
} from "@/lib/serve-size";
import type { MenuSection } from "@/lib/menu-section";
import type { Modifier, ModifierGroup, ProductWithModifiers } from "@/types";

export function ProductDetailSheet({
  product,
  currency,
  open,
  onOpenChange,
  orderingDisabled = false,
  menuSection = "food",
}: {
  product: ProductWithModifiers | null;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderingDisabled?: boolean;
  menuSection?: MenuSection;
}) {
  const addItem = useCart((s) => s.addItem);
  const { tName, tDescription, tUI } = useAppLocale();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [serveSize, setServeSize] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !product) return;
    setQuantity(1);
    setNotes("");
    setServeSize(null);
    setSelected({});
  }, [product?.id, open]);

  const groups = product?.modifier_groups ?? [];
  const showServeSize = product ? productHasServeSize(product) : false;
  const servePresets = product?.serve_size_presets ?? [];

  const selectedModifiers = useMemo(() => {
    const result: Array<{ modifierId: string; modifierName: string; price: number }> = [];
    for (const group of groups) {
      const ids = selected[group.id] ?? [];
      for (const modId of ids) {
        const mod = group.modifiers.find((m) => m.id === modId);
        if (mod) {
          result.push({
            modifierId: mod.id,
            modifierName: tName(mod),
            price: Number(mod.price),
          });
        }
      }
    }
    return result;
  }, [groups, selected, tName]);

  const lineTotal = useMemo(() => {
    if (!product) return 0;
    const modTotal = selectedModifiers.reduce((s, m) => s + m.price, 0);
    return (Number(product.price) + modTotal) * quantity;
  }, [product, selectedModifiers, quantity]);

  const missingRequired = groups.some(
    (g) => g.is_required && (selected[g.id]?.length ?? 0) < Math.max(1, g.min_select)
  );
  const missingServeSize =
    showServeSize && (!serveSize || !isValidServeSize(serveSize));
  const outOfStock = product ? !product.is_available : false;
  const cannotAdd =
    outOfStock || orderingDisabled || missingRequired || missingServeSize;

  function toggleModifier(group: ModifierGroup, modifier: Modifier) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [modifier.id] };
      }
      if (current.includes(modifier.id)) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== modifier.id),
        };
      }
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...current, modifier.id] };
    });
  }

  function handleAdd() {
    if (!product || cannotAdd) return;
    const displayName = tName(product);
    addItem({
      productId: product.id,
      productName: displayName,
      unitPrice: Number(product.price),
      quantity,
      notes,
      serveSize,
      menuSection,
      productTaxRate:
        product.tax_rate != null ? Number(product.tax_rate) : null,
      modifiers: selectedModifiers,
    });
    toastAddedToCart(displayName, lineTotal, currency);
    setQuantity(1);
    setNotes("");
    setServeSize(null);
    setSelected({});
    onOpenChange(false);
  }

  if (!product) return null;

  const displayName = tName(product);
  const displayDescription = tDescription(product);
  const addLabel = outOfStock
    ? tUI("menu.currentlyUnavailable")
    : orderingDisabled
      ? tUI("product.orderingPaused")
      : tUI("product.addToCart", {
          amount: formatPrice(lineTotal, currency),
        });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="guest-theme flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border-zinc-800 bg-zinc-900 p-0 text-zinc-50"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-zinc-700" />

          {product.image_url ? (
            <div className="relative h-48 w-full sm:h-56">
              <Image
                src={product.image_url}
                alt={displayName}
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
            </div>
          ) : null}

          <div className="px-5 pb-4 pt-4">
            <SheetHeader className="text-start">
              <SheetTitle className="flex items-baseline justify-between gap-4 pe-8 text-zinc-50">
                <span>{displayName}</span>
                <span className="text-price shrink-0 text-orange-500">
                  {formatPrice(Number(product.price), currency)}
                </span>
              </SheetTitle>
            </SheetHeader>

            <ProductIngredients
              description={displayDescription}
              allergens={product.allergens}
              tags={product.tags}
              className="mt-4"
            />

            <div className="mt-6 space-y-6">
              {showServeSize && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                      {tUI("product.serveSize")}
                    </h4>
                    <span className="rounded bg-orange-500/12 px-2 py-0.5 text-caption text-orange-500">
                      {tUI("product.required")}
                    </span>
                  </div>
                  <ServeSizeSelector
                    presets={servePresets}
                    allowCustom={product.allow_custom_serve_size}
                    value={serveSize}
                    onChange={setServeSize}
                  />
                </div>
              )}

              {groups.map((group) => (
                <div key={group.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                      {tName(group)}
                    </h4>
                    {group.is_required && (
                      <span className="rounded bg-orange-500/12 px-2 py-0.5 text-caption text-orange-500">
                        {tUI("product.required")}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.modifiers.map((modifier) => {
                      const checked = (selected[group.id] ?? []).includes(
                        modifier.id
                      );
                      return (
                        <label
                          key={modifier.id}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleModifier(group, modifier)
                              }
                            />
                            <span className="text-sm text-zinc-100">
                              {tName(modifier)}
                            </span>
                          </div>
                          <span className="text-sm tabular-nums text-zinc-400">
                            {Number(modifier.price) > 0
                              ? `+${formatPrice(Number(modifier.price), currency)}`
                              : tUI("product.free")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                  {tUI("checkout.notes")}
                </h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tUI("product.notesPlaceholder")}
                  rows={2}
                  className="border-zinc-700 bg-zinc-950 text-zinc-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 pt-3 pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          <div className="mb-3">
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>
          <AddToCartButton
            label={addLabel}
            disabled={cannotAdd}
            onAdd={handleAdd}
          />
          {!outOfStock && (missingRequired || missingServeSize) && (
            <p className="mt-2 text-center text-caption text-zinc-500">
              {missingServeSize
                ? tUI("product.selectServeSize")
                : tUI("product.selectRequired")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
