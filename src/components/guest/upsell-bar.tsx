"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { readJsonResponse } from "@/lib/api/read-json-response";
import type { UpsellSuggestion } from "@/lib/upsell/get-suggestions";
import { Button } from "@/components/ui/button";

export function UpsellBar({
  locationId,
  currency,
  variant = "cart",
}: {
  locationId: string;
  currency: string;
  variant?: "cart" | "checkout";
}) {
  const { tUI, tName } = useAppLocale();
  const items = useCart((s) => s.items);
  const cartBump = useCart((s) => s.cartBump);
  const addItem = useCart((s) => s.addItem);
  const [suggestions, setSuggestions] = useState<UpsellSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const productIds = items.map((i) => i.productId).join(",");

  const load = useCallback(async () => {
    if (!productIds) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/upsell/suggestions?locationId=${encodeURIComponent(locationId)}&productIds=${encodeURIComponent(productIds)}`
      );
      const parsed = await readJsonResponse<{
        data?: { suggestions: UpsellSuggestion[] };
      }>(res);
      if (parsed.ok && parsed.data.data?.suggestions) {
        setSuggestions(parsed.data.data.suggestions);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, productIds]);

  useEffect(() => {
    void load();
  }, [load, cartBump]);

  function handleAdd(suggestion: UpsellSuggestion) {
    if (suggestion.product.hasModifiers) return;

    hapticClick();
    const displayName = tName(suggestion.product);
    addItem({
      productId: suggestion.product.id,
      productName: displayName,
      unitPrice: suggestion.product.price,
      quantity: 1,
      notes: "",
      menuSection: suggestion.product.menuSection,
      productTaxRate: suggestion.product.tax_rate,
      modifiers: [],
    });
    toastAddedToCart(displayName, suggestion.product.price, currency);
  }

  if (!loading && suggestions.length === 0) return null;

  const title =
    variant === "checkout" ? tUI("upsell.checkoutTitle") : tUI("upsell.title");

  return (
    <AnimatePresence mode="wait">
      {suggestions.length > 0 && (
        <motion.section
          key={productIds}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="mb-4"
        >
          <h2 className="mb-2 text-sm font-semibold text-zinc-200">{title}</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
            {suggestions.map((suggestion) => {
              const displayName = tName(suggestion.product);
              const message =
                suggestion.message ??
                tUI("upsell.defaultMessage", {
                  name: displayName,
                  amount: formatPrice(suggestion.product.price, currency),
                });

              return (
                <div
                  key={suggestion.ruleId}
                  className="w-[min(72vw,240px)] shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                >
                  <div className="relative h-24 bg-gradient-to-br from-zinc-800 to-zinc-900">
                    {suggestion.product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={suggestion.product.image_url}
                        alt={displayName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl font-bold text-zinc-700">
                        {displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {displayName}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                      {message}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-orange-500">
                        {formatPrice(suggestion.product.price, currency)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={suggestion.product.hasModifiers}
                        onClick={() => handleAdd(suggestion)}
                        className="h-8 rounded-lg bg-orange-500 px-3 text-xs font-semibold hover:bg-orange-600"
                      >
                        <Plus className="mr-1 size-3.5" />
                        {tUI("upsell.add")}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
