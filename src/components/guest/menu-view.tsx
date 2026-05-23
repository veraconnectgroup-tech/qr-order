"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { CartSummaryBar } from "@/components/guest/cart-summary-bar";
import { CategoryPills } from "@/components/guest/category-pills";
import { GuestHeader } from "@/components/guest/guest-header";
import { LanguageSelector } from "@/components/guest/language-selector";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { OfflineIndicator } from "@/components/guest/offline-indicator";
import { ProductCard } from "@/components/guest/product-card";
import { ProductDetailSheet } from "@/components/guest/product-detail-sheet";
import { PullToRefresh } from "@/components/guest/pull-to-refresh";
import {
  AllergenFilter,
  useAllergenExclusions,
  allergenFilterStorageKey,
} from "@/components/guest/allergen-filter";
import { MenuGrid, type MenuCategory } from "@/components/guest/menu-grid";
import { isProductHiddenByAllergenFilter } from "@/lib/allergens";
import {
  formatScheduleGuestHint,
  isCategoryAvailable,
} from "@/lib/menu/schedule";
import { productMatchesSearch } from "@/lib/i18n/menu-locale";
import { inferMenuSection, type MenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

export function MenuView({
  slug,
  token,
  orgName,
  logoUrl,
  locationName,
  tableName,
  zoneName,
  categories,
  unavailableCategories = [],
  taxPercent,
  currency,
  locationId,
  tableId,
  timezone,
  orderingEnabled = true,
}: {
  slug: string;
  token: string;
  orgName: string;
  logoUrl?: string | null;
  locationName: string;
  tableName: string;
  zoneName: string | null;
  categories: MenuCategory[];
  unavailableCategories?: MenuCategory[];
  taxPercent: number;
  currency: string;
  locationId: string;
  tableId: string;
  timezone: string;
  orderingEnabled?: boolean;
}) {
  const { tUI, tName } = useAppLocale();
  const router = useRouter();
  const scrollKey = `menu-scroll-${slug}-${token}`;
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [now, setNow] = useState(() => new Date());
  const [detailProduct, setDetailProduct] = useState<ProductWithModifiers | null>(
    null
  );
  const [returnGlow, setReturnGlow] = useState(false);
  const restoredScroll = useRef(false);

  const openProductDetail = useCallback((product: ProductWithModifiers) => {
    (document.activeElement as HTMLElement | null)?.blur();
    setDetailProduct(product);
  }, []);

  const setCartSession = useCart((s) => s.setSession);
  const itemCount = useCart((s) => s.itemCount());
  const setGuestSession = useGuestSession((s) => s.setSession);

  const allergenStorageKey = allergenFilterStorageKey(slug, token);
  const { excluded, toggle, clear, count: allergenFilterCount } =
    useAllergenExclusions(allergenStorageKey);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { scheduledCategories, scheduledUnavailable } = useMemo(() => {
    const available: MenuCategory[] = [];
    const unavailable: MenuCategory[] = [];

    for (const category of categories) {
      const scheduleRow = {
        schedule_enabled: category.schedule_enabled ?? false,
        schedule_start: category.schedule_start ?? null,
        schedule_end: category.schedule_end ?? null,
        schedule_days: category.schedule_days ?? null,
      };

      if (isCategoryAvailable(scheduleRow, now, timezone)) {
        available.push(category);
      } else if (scheduleRow.schedule_enabled) {
        unavailable.push({
          ...category,
          scheduleHint:
            category.scheduleHint ??
            formatScheduleGuestHint(tName(category), scheduleRow) ??
            tUI("menu.scheduleUnavailable"),
        });
      }
    }

    return {
      scheduledCategories: available,
      scheduledUnavailable: unavailable,
    };
  }, [categories, now, timezone, tName, tUI]);

  const allUnavailableCategories = useMemo(
    () => [...scheduledUnavailable, ...unavailableCategories],
    [scheduledUnavailable, unavailableCategories]
  );

  const subtitle = zoneName
    ? `${zoneName} · ${locationName}`
    : locationName;

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch(`/api/tables/${token}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) return;
        const json = await res.json();
        const { sessionId, sessionToken, tableName: tn, locationId: lid } =
          json.data;
        setGuestSession({
          sessionId,
          sessionToken,
          tableId,
          tableName: tn,
          locationId: lid,
          restaurantSlug: slug,
        });
        setCartSession(slug, token, tn, sessionToken);
      } catch {
        // Session init failed silently; checkout will prompt refresh
      }
    }
    initSession();
  }, [token, slug, tableId, setCartSession, setGuestSession]);

  useEffect(() => {
    if (restoredScroll.current) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved, 10));
        restoredScroll.current = true;
        if (itemCount > 0) setReturnGlow(true);
        setTimeout(() => setReturnGlow(false), 2000);
      });
    }
  }, [scrollKey, itemCount]);

  useEffect(() => {
    const save = () => sessionStorage.setItem(scrollKey, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [scrollKey]);

  const filteredCategories = useMemo(() => {
    if (allergenFilterCount === 0) return scheduledCategories;
    return scheduledCategories
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (product) =>
            !isProductHiddenByAllergenFilter(product.allergens, excluded)
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [scheduledCategories, excluded, allergenFilterCount]);

  useEffect(() => {
    if (search.trim() || !filteredCategories.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveCategory(visible[0].target.id.replace("cat-", ""));
        }
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: 0 }
    );

    filteredCategories.forEach((cat) => {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredCategories, search]);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`cat-${catId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  const hiddenByAllergenCount = useMemo(() => {
    if (allergenFilterCount === 0) return 0;
    const total = scheduledCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    const visible = filteredCategories.reduce(
      (sum, cat) => sum + cat.products.length,
      0
    );
    return total - visible;
  }, [scheduledCategories, filteredCategories, allergenFilterCount]);

  useEffect(() => {
    if (!filteredCategories.length) return;
    if (!filteredCategories.some((cat) => cat.id === activeCategory)) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategory]);

  const allProducts = filteredCategories.flatMap((c) => c.products);
  const menuSectionByProductId = useMemo(() => {
    const map = new Map<string, MenuSection>();
    for (const category of filteredCategories) {
      const section = inferMenuSection(category);
      for (const product of category.products) {
        map.set(product.id, section);
      }
    }
    return map;
  }, [filteredCategories]);
  const searchQuery = search.trim();
  const filtered = searchQuery
    ? allProducts.filter((p) => productMatchesSearch(p, searchQuery))
    : null;

  return (
    <>
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh} orgInitial={orgName.charAt(0)}>
        <div className="min-h-dvh pb-cart-offset">
          <GuestHeader
            orgName={orgName}
            logoUrl={logoUrl}
            subtitle={subtitle}
            tableName={tableName}
            trailing={<LanguageSelector compact />}
          />

          {!orderingEnabled && (
            <div className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {tUI("menu.orderingPaused")}
            </div>
          )}

          <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500 sm:left-4" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tUI("menu.search")}
                  className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-4 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-700 sm:py-2.5 sm:text-sm"
                />
              </div>
            </div>
            {!filtered && (
              <>
                <CategoryPills
                  categories={filteredCategories}
                  activeCategory={activeCategory}
                  onSelect={scrollToCategory}
                />
                <AllergenFilter
                  excluded={excluded}
                  onToggle={toggle}
                  onClear={clear}
                />
              </>
            )}
          </div>

          <main className="px-3 py-4 sm:px-4 sm:py-6">
            {hiddenByAllergenCount > 0 && (
              <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
                {tUI("allergen.hiddenCount", { count: hiddenByAllergenCount })}
              </p>
            )}
            {filtered ? (
              <div>
                {filtered.length === 0 ? (
                  <p className="py-12 text-center text-zinc-400">
                    {tUI("menu.noResults", { query: searchQuery })}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    {filtered.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        currency={currency}
                        menuSection={
                          menuSectionByProductId.get(product.id) ?? "food"
                        }
                        orderingDisabled={!orderingEnabled}
                        onOpenDetail={() => openProductDetail(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MenuGrid
                categories={filteredCategories}
                unavailableCategories={allUnavailableCategories}
                currency={currency}
                orderingDisabled={!orderingEnabled}
                onOpenDetail={openProductDetail}
              />
            )}

            <div className="mt-8 flex justify-center pb-4">
              <CallWaiterButton token={token} tableName={tableName} />
            </div>
          </main>

          <CartSummaryBar
            slug={slug}
            token={token}
            taxPercent={taxPercent}
            currency={currency}
            glowOnMount={returnGlow}
          />

          <ProductDetailSheet
            product={detailProduct}
            currency={currency}
            orderingDisabled={!orderingEnabled}
            menuSection={
              detailProduct
                ? menuSectionByProductId.get(detailProduct.id) ?? "food"
                : "food"
            }
            open={!!detailProduct}
            onOpenChange={(o) => !o && setDetailProduct(null)}
          />
        </div>
      </PullToRefresh>
    </>
  );
}
