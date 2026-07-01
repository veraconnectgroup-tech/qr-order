"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuCategory } from "@/components/guest/menu-grid";
import {
  buildMenuItemFromProduct,
  createTranslationCache,
  translateMenuForGuest,
  type MenuItem,
  type TranslatedMenuItem,
  type TranslationCache,
} from "@/lib/denis/intelligence/menu-translation";
import type { ProductWithModifiers } from "@/types";

export type GuestMenuTranslation = {
  name: string;
  description: string;
  language: string;
};

export type MenuProductWithGuestTranslation = ProductWithModifiers & {
  guestTranslation?: GuestMenuTranslation;
};

function categoriesToMenuItems(categories: MenuCategory[]): MenuItem[] {
  return categories.flatMap((category) =>
    category.products.map((product) => buildMenuItemFromProduct(product))
  );
}

function applyTranslationsToCategories(
  categories: MenuCategory[],
  translated: Map<string, TranslatedMenuItem>
): MenuCategory[] {
  return categories.map((category) => ({
    ...category,
    products: category.products.map((product) => {
      const row = translated.get(product.id);
      if (!row) return product;

      const guestTranslation: GuestMenuTranslation = {
        name: row.translatedName,
        description: row.translatedDescription,
        language: row.language,
      };

      if (
        row.originalName === row.translatedName &&
        row.originalDescription === row.translatedDescription
      ) {
        return product;
      }

      return {
        ...product,
        guestTranslation,
      } satisfies MenuProductWithGuestTranslation;
    }),
  }));
}

async function fetchMenuTranslations(input: {
  locationId: string;
  tableId: string;
  sessionToken: string;
  targetLanguage: string;
  sourceLanguage: string;
  items: MenuItem[];
}): Promise<TranslatedMenuItem[]> {
  const res = await fetch("/api/guest/menu-translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: { items?: TranslatedMenuItem[] };
    error?: string;
  } | null;

  if (!res.ok || !json?.data?.items) {
    throw new Error(json?.error ?? "Menu translation failed.");
  }

  return json.data.items;
}

const globalCache: TranslationCache = createTranslationCache();

export function useTranslatedMenuCategories(input: {
  categories: MenuCategory[];
  targetLanguage: string | null | undefined;
  sourceLanguage: string;
  locationId?: string;
  tableId?: string;
  sessionToken?: string | null;
  enabled?: boolean;
}): { categories: MenuCategory[]; translating: boolean } {
  const [categories, setCategories] = useState(input.categories);
  const [translating, setTranslating] = useState(false);

  const target = input.targetLanguage?.trim().toLowerCase().slice(0, 2) ?? null;
  const source = input.sourceLanguage.trim().toLowerCase().slice(0, 2);
  const enabled = input.enabled !== false;
  const canUseApi = Boolean(
    input.locationId && input.tableId && input.sessionToken
  );

  const menuItems = useMemo(
    () => categoriesToMenuItems(input.categories),
    [input.categories]
  );

  useEffect(() => {
    setCategories(input.categories);
  }, [input.categories]);

  useEffect(() => {
    if (!enabled || !target || target === source) {
      setCategories(input.categories);
      return;
    }

    let cancelled = false;
    setTranslating(true);

    const run = async () => {
      try {
        let rows: TranslatedMenuItem[];

        if (canUseApi) {
          rows = await fetchMenuTranslations({
            locationId: input.locationId!,
            tableId: input.tableId!,
            sessionToken: input.sessionToken!,
            targetLanguage: target,
            sourceLanguage: source,
            items: menuItems,
          });
          for (const row of rows) {
            const lang = row.language.toLowerCase().slice(0, 2);
            let productMap = globalCache.get(row.id);
            if (!productMap) {
              productMap = new Map();
              globalCache.set(row.id, productMap);
            }
            productMap.set(lang, row);
          }
        } else {
          rows = await translateMenuForGuest({
            menu: menuItems,
            targetLanguage: target,
            cache: globalCache,
            sourceLanguage: source,
          });
        }

        if (cancelled) return;

        const map = new Map(rows.map((row) => [row.id, row]));
        setCategories(applyTranslationsToCategories(input.categories, map));
      } catch {
        if (!cancelled) {
          setCategories(input.categories);
        }
      } finally {
        if (!cancelled) setTranslating(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    target,
    source,
    input.categories,
    menuItems,
    canUseApi,
    input.locationId,
    input.tableId,
    input.sessionToken,
  ]);

  return { categories, translating };
}
