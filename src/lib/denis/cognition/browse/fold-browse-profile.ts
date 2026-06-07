import { classifyBrowseDomain } from "@/lib/denis/cognition/browse/classify-browse-domain";
import type { BrowseEvent, GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
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

/** Build GuestBrowseProfile from timeline browse telemetry (pure fold, no DB). */
export function foldBrowseProfile(timeline: DenisTimelineRow[]): GuestBrowseProfile {
  const profile = emptyBrowseProfile();

  const categoryMap = new Map<string, GuestBrowseProfile["viewedCategories"][0]>();
  const productMap = new Map<string, GuestBrowseProfile["viewedProducts"][0]>();
  const addedProducts = new Set<string>();
  const removedAtByProduct = new Map<string, string>();

  for (const row of timeline) {
    const event = isBrowsePerceptionRow(row);
    if (!event) continue;

    profile.eventCount++;
    profile.totalBrowseMs += event.dwellMs ?? 0;

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
        removedAtByProduct.set(key, event.timestamp || row.created_at);
      }

      if (event.action === "view_product" || event.action === "add_to_cart") {
        const existing = productMap.get(key);
        if (existing) {
          existing.viewCount++;
          existing.totalDwellMs += event.dwellMs ?? 0;
          if (event.action === "add_to_cart") existing.addedToCart = true;
        } else {
          productMap.set(key, {
            productId: key,
            productName: event.productName ?? key,
            categoryPath: event.categoryPath ?? [],
            viewCount: 1,
            totalDwellMs: event.dwellMs ?? 0,
            addedToCart: event.action === "add_to_cart",
            removedFromCart: false,
          });
        }
      }
    }
  }

  for (const [pid, removedAt] of removedAtByProduct) {
    const product = productMap.get(pid);
    if (!product) continue;
    product.removedFromCart = true;
    if (addedProducts.has(pid)) {
      profile.cartAbandoned.push({
        productId: product.productId,
        productName: product.productName,
        removedAt,
      });
    }
  }

  profile.viewedCategories = [...categoryMap.values()].sort(
    (a, b) => b.totalDwellMs - a.totalDwellMs
  );
  profile.viewedProducts = [...productMap.values()].sort(
    (a, b) => b.totalDwellMs - a.totalDwellMs
  );

  return profile;
}
