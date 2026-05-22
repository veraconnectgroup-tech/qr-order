"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { CartSummaryBar } from "@/components/guest/cart-summary-bar";
import { CategoryPills } from "@/components/guest/category-pills";
import { GuestHeader } from "@/components/guest/guest-header";
import { MenuGrid, type MenuCategory } from "@/components/guest/menu-grid";
import { OfflineIndicator } from "@/components/guest/offline-indicator";
import { ProductCard } from "@/components/guest/product-card";
import { ProductDetailSheet } from "@/components/guest/product-detail-sheet";
import { PullToRefresh } from "@/components/guest/pull-to-refresh";
import { Input } from "@/components/ui/input";
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
  taxPercent,
  currency,
  locationId,
  tableId,
}: {
  slug: string;
  token: string;
  orgName: string;
  logoUrl?: string | null;
  locationName: string;
  tableName: string;
  zoneName: string | null;
  categories: MenuCategory[];
  taxPercent: number;
  currency: string;
  locationId: string;
  tableId: string;
}) {
  const router = useRouter();
  const scrollKey = `menu-scroll-${slug}-${token}`;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [detailProduct, setDetailProduct] = useState<ProductWithModifiers | null>(
    null
  );
  const [returnGlow, setReturnGlow] = useState(false);
  const restoredScroll = useRef(false);

  const setCartSession = useCart((s) => s.setSession);
  const itemCount = useCart((s) => s.itemCount());
  const setGuestSession = useGuestSession((s) => s.setSession);

  const subtitle = zoneName
    ? `${zoneName} · ${locationName}`
    : locationName;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function initSession() {
      const res = await fetch(`/api/tables/${token}/session`, {
        method: "POST",
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

  useEffect(() => {
    if (debouncedSearch || !categories.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveCategory(visible[0].target.id.replace("cat-", ""));
        }
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 }
    );

    categories.forEach((cat) => {
      const el = document.getElementById(`cat-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories, debouncedSearch]);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`cat-${catId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  const allProducts = categories.flatMap((c) => c.products);
  const filtered = debouncedSearch.trim()
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : null;

  return (
    <>
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh} orgInitial={orgName.charAt(0)}>
        <div className="min-h-screen pb-24">
          <GuestHeader
            orgName={orgName}
            logoUrl={logoUrl}
            subtitle={subtitle}
            tableName={tableName}
          />

          <div className="sticky top-[73px] z-30 border-b border-zinc-800/50 bg-[#09090b]/90 backdrop-blur-md">
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
            </div>
            {!filtered && (
              <CategoryPills
                categories={categories}
                activeCategory={activeCategory}
                onSelect={scrollToCategory}
              />
            )}
          </div>

          <main className="px-4 py-6">
            {filtered ? (
              <div>
                {filtered.length === 0 ? (
                  <p className="py-12 text-center text-zinc-400">
                    No results for &quot;{debouncedSearch}&quot;
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filtered.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        currency={currency}
                        onOpenDetail={() => setDetailProduct(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MenuGrid
                categories={categories}
                currency={currency}
                onOpenDetail={setDetailProduct}
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
            open={!!detailProduct}
            onOpenChange={(o) => !o && setDetailProduct(null)}
          />
        </div>
      </PullToRefresh>
    </>
  );
}
