"use client";

import { useMemo, useState } from "react";
import { useMenuLocale } from "@/components/guest/menu-locale-provider";
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
  const { tName, tDescription, locale } = useMenuLocale();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [serveSize, setServeSize] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

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
          const modName =
            locale === "en" && mod.name_en?.trim() ? mod.name_en.trim() : mod.name;
          result.push({
            modifierId: mod.id,
            modifierName: modName,
            price: Number(mod.price),
          });
        }
      }
    }
    return result;
  }, [groups, selected, locale]);

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
    if (!product || missingRequired || missingServeSize) return;
    const displayName = tName(product);
    addItem({
      productId: product.id,
      productName: displayName,
      unitPrice: Number(product.price),
      quantity,
      notes,
      serveSize,
      menuSection,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl border-zinc-800 bg-zinc-900 p-0 text-zinc-50"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-zinc-700" />

        {product.image_url ? (
          <div className="relative h-48 w-full sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt={displayName}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
          </div>
        ) : null}

        <div className="px-5 pb-8 pt-4">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-baseline justify-between gap-4 pr-8 text-zinc-50">
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
                  Serve size
                </h4>
                <span className="rounded bg-orange-500/12 px-2 py-0.5 text-caption text-orange-500">
                  Required
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
                  {locale === "en" && group.name_en?.trim()
                    ? group.name_en.trim()
                    : group.name}
                </h4>
                {group.is_required && (
                  <span className="rounded bg-orange-500/12 px-2 py-0.5 text-caption text-orange-500">
                    Required
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {group.modifiers.map((modifier) => {
                  const checked = (selected[group.id] ?? []).includes(modifier.id);
                  return (
                    <label
                      key={modifier.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleModifier(group, modifier)}
                        />
                        <span className="text-sm text-zinc-100">
                          {locale === "en" && modifier.name_en?.trim()
                            ? modifier.name_en.trim()
                            : modifier.name}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums text-zinc-400">
                        {Number(modifier.price) > 0
                          ? `+${formatPrice(Number(modifier.price), currency)}`
                          : "Free"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Special instructions
            </h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No ice, extra cold..."
              rows={2}
              className="border-zinc-700 bg-zinc-950 text-zinc-100"
            />
          </div>

          <QuantitySelector value={quantity} onChange={setQuantity} />

          <AddToCartButton
            label={
              orderingDisabled
                ? "Ordering paused"
                : `Add to Cart · ${formatPrice(lineTotal, currency)}`
            }
            disabled={missingRequired || missingServeSize || orderingDisabled}
            onAdd={handleAdd}
          />
          {(missingRequired || missingServeSize) && (
            <p className="text-center text-caption text-zinc-500">
              {missingServeSize
                ? "Select or enter a serve size"
                : "Select all required options"}
            </p>
          )}
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
