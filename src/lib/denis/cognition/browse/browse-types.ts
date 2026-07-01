import type {
  BrowseAction,
  BrowseMenuSection,
} from "@/lib/denis/platform/timeline-types";

export type { BrowseAction, BrowseMenuSection };

export type BrowseProductDisposition = "viewed" | "interested" | "abandoned";

export type BrowseEvent = {
  action: BrowseAction;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryPath?: string[];
  /** Catalog menu_section when known — preferred over path heuristics. */
  menuSection?: BrowseMenuSection | null;
  dwellMs?: number;
  /** Snapshot unit price when guest opened product (EUR). */
  unitPrice?: number;
  /** Line total at add_to_cart time (for upsell ROI). */
  lineTotal?: number;
  /** Scroll intelligence — fast search / slow category / bottom. */
  scrollIntent?: "fast_search" | "slow_category" | "reached_bottom";
  scrollVelocityPxPerSec?: number;
  /** Client nudge A/B — kind, variant, action (shown | click | dismiss). */
  nudgeKind?: string;
  nudgeVariant?: "A" | "B";
  nudgeAction?: "shown" | "click" | "dismiss";
  timestamp: string;
};

export type GuestBrowseProfile = {
  viewedCategories: Array<{
    categoryId: string;
    categoryPath: string[];
    viewCount: number;
    totalDwellMs: number;
  }>;
  viewedProducts: Array<{
    productId: string;
    productName: string;
    categoryPath: string[];
    categoryId?: string;
    viewCount: number;
    totalDwellMs: number;
    addedToCart: boolean;
    removedFromCart: boolean;
    disposition: BrowseProductDisposition;
    unitPrice?: number;
    /** Latest browse telemetry timestamp for this product (fold-derived). */
    lastViewedAt?: string;
  }>;
  /** Category clusters — e.g. 3+ salads viewed without ordering. */
  categoryFocus: Array<{
    categoryId: string;
    categoryLabel: string;
    menuSection: BrowseMenuSection | null;
    uniqueProductCount: number;
    totalViewCount: number;
    totalDwellMs: number;
    firstViewedAt: string;
    lastViewedAt: string;
  }>;
  interestedProducts: Array<{
    productId: string;
    productName: string;
    lastViewedAt: string;
    totalDwellMs: number;
  }>;
  abandonedProducts: Array<{
    productId: string;
    productName: string;
    lastViewedAt: string;
  }>;
  priceBrowseStats: {
    viewedPriceCount: number;
    avgViewedPrice: number | null;
    maxViewedPrice: number | null;
    onlyBudgetItems: boolean;
    onlyPremiumItems: boolean;
  };
  dominantMenuSection: BrowseMenuSection | null;
  sessionStartedAt: string | null;
  lastBrowseAt: string | null;
  topFollowUpProduct: {
    productId: string;
    productName: string;
    lastViewedAt: string;
    disposition: BrowseProductDisposition;
    totalDwellMs: number;
  } | null;
  cartAbandoned: Array<{
    productId: string;
    productName: string;
    removedAt: string;
  }>;
  scrollIntents: Array<{
    intent: "fast_search" | "slow_category" | "reached_bottom";
    categoryLabel?: string;
    at: string;
  }>;
  browsedFood: boolean;
  browsedDrinks: boolean;
  browsedDesserts: boolean;
  totalBrowseMs: number;
  eventCount: number;
};

export function emptyBrowseProfile(): GuestBrowseProfile {
  return {
    viewedCategories: [],
    viewedProducts: [],
    categoryFocus: [],
    interestedProducts: [],
    abandonedProducts: [],
    priceBrowseStats: {
      viewedPriceCount: 0,
      avgViewedPrice: null,
      maxViewedPrice: null,
      onlyBudgetItems: false,
      onlyPremiumItems: false,
    },
    dominantMenuSection: null,
    sessionStartedAt: null,
    lastBrowseAt: null,
    topFollowUpProduct: null,
    cartAbandoned: [],
    scrollIntents: [],
    browsedFood: false,
    browsedDrinks: false,
    browsedDesserts: false,
    totalBrowseMs: 0,
    eventCount: 0,
  };
}
