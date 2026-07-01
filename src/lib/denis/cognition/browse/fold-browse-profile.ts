import { classifyBrowseDomain, resolveCategoryLabel } from "@/lib/denis/cognition/browse/classify-browse-domain";
import type { BrowseEvent, GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  finalizeBrowseProfile,
  isProductViewAction,
  resolveProductDisposition,
} from "@/lib/denis/cognition/browse/fold-browse-profile.helpers";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function isBrowsePerceptionRow(row: DenisTimelineRow): BrowseEvent | null {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { type?: string }).type !== "perception.ingested") return null;

  const frame = (payload as { frame?: { channel?: string } }).frame;
  if (frame?.channel !== "telemetry.browse") return null;

  const event = (payload as { browseEvent?: BrowseEvent }).browseEvent;
  if (!event || typeof event !== "object") return null;
  return event;
}

export function foldBrowseProfile(
  timeline: DenisTimelineRow[]
): GuestBrowseProfile {
  const profile = emptyBrowseProfile();

  const categoryMap = new Map<string, GuestBrowseProfile["viewedCategories"][0]>();
  const productMap = new Map<string, GuestBrowseProfile["viewedProducts"][0]>();
  const categoryFocusMap = new Map<string, GuestBrowseProfile["categoryFocus"][0]>();
  const categoryProductIds = new Map<string, Set<string>>();
  const addedProducts = new Set<string>();
  const removedAtByProduct = new Map<string, string>();
  const pricedViews: number[] = [];

  for (const row of timeline) {
    const event = isBrowsePerceptionRow(row);
    if (!event) continue;

    const at = event.timestamp || row.created_at;
    profile.eventCount++;
    profile.totalBrowseMs += event.dwellMs ?? 0;
    profile.sessionStartedAt ??= at;
    profile.lastBrowseAt = at;

    const domain = classifyBrowseDomain(event);
    if (domain === "food") profile.browsedFood = true;
    if (domain === "drinks") profile.browsedDrinks = true;
    if (domain === "desserts") profile.browsedDesserts = true;

    if (event.categoryPath?.length && event.categoryId) {
      const key = event.categoryId;
      const existing = categoryMap.get(key);
      if (existing) {
        existing.viewCount++;
        existing.totalDwellMs += event.dwellMs ?? 0;
      } else {
        categoryMap.set(key, {
          categoryId: key,
          categoryPath: event.categoryPath,
          viewCount: 1,
          totalDwellMs: event.dwellMs ?? 0,
        });
      }
    }

    if (event.productId) {
      const key = event.productId;

      if (event.action === "add_to_cart") addedProducts.add(key);
      if (event.action === "remove_from_cart") {
        removedAtByProduct.set(key, at);
      }

      if (isProductViewAction(event.action) || event.action === "add_to_cart") {
        const dwell = event.dwellMs ?? 0;
        const existing = productMap.get(key);
        const addedToCart =
          event.action === "add_to_cart" || addedProducts.has(key);
        const removedFromCart = removedAtByProduct.has(key);

        if (existing) {
          existing.viewCount++;
          existing.totalDwellMs += dwell;
          existing.lastViewedAt = at;
          if (event.action === "add_to_cart") existing.addedToCart = true;
          if (event.unitPrice != null) existing.unitPrice = event.unitPrice;
          existing.removedFromCart = removedFromCart;
          existing.disposition = resolveProductDisposition({
            dwellMs: existing.totalDwellMs,
            addedToCart: existing.addedToCart,
            removedFromCart: existing.removedFromCart,
          });
        } else {
          productMap.set(key, {
            productId: key,
            productName: event.productName ?? key,
            categoryPath: event.categoryPath ?? [],
            categoryId: event.categoryId,
            viewCount: 1,
            totalDwellMs: dwell,
            addedToCart,
            removedFromCart,
            disposition: resolveProductDisposition({
              dwellMs: dwell,
              addedToCart,
              removedFromCart,
            }),
            unitPrice: event.unitPrice,
            lastViewedAt: at,
          });
        }

        if (event.unitPrice != null && isProductViewAction(event.action)) {
          pricedViews.push(event.unitPrice);
        }

        if (event.categoryId) {
          const label = resolveCategoryLabel(event.categoryPath, event.categoryId);
          const ids =
            categoryProductIds.get(event.categoryId) ?? new Set<string>();
          ids.add(key);
          categoryProductIds.set(event.categoryId, ids);

          const focus = categoryFocusMap.get(event.categoryId);
          if (focus) {
            categoryFocusMap.set(event.categoryId, {
              ...focus,
              uniqueProductCount: ids.size,
              totalViewCount: focus.totalViewCount + 1,
              totalDwellMs: focus.totalDwellMs + dwell,
              lastViewedAt: at,
            });
          } else {
            categoryFocusMap.set(event.categoryId, {
              categoryId: event.categoryId,
              categoryLabel: label,
              menuSection: domain,
              uniqueProductCount: ids.size,
              totalViewCount: 1,
              totalDwellMs: dwell,
              firstViewedAt: at,
              lastViewedAt: at,
            });
          }
        }
      }
    }

    if (event.action === "scroll_menu" && event.scrollIntent) {
      profile.scrollIntents.push({
        intent: event.scrollIntent,
        categoryLabel: event.categoryPath?.[1],
        at,
      });
    }
  }

  for (const [pid, removedAt] of removedAtByProduct) {
    const product = productMap.get(pid);
    if (!product) continue;
    product.removedFromCart = true;
    product.disposition = resolveProductDisposition({
      dwellMs: product.totalDwellMs,
      addedToCart: product.addedToCart,
      removedFromCart: true,
    });
    if (addedProducts.has(pid)) {
      profile.cartAbandoned.push({
        productId: product.productId,
        productName: product.productName,
        removedAt,
      });
    }
  }

  return finalizeBrowseProfile(
    profile,
    productMap,
    categoryMap,
    categoryFocusMap,
    pricedViews
  );
}
