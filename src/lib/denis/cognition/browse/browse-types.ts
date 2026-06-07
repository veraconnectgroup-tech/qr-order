export type BrowseAction =
  | "view_category"
  | "view_product"
  | "add_to_cart"
  | "remove_from_cart"
  | "scroll_menu";

export type BrowseMenuSection = "food" | "drinks" | "desserts";

export type BrowseEvent = {
  action: BrowseAction;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryPath?: string[];
  /** Catalog menu_section when known — preferred over path heuristics. */
  menuSection?: BrowseMenuSection | null;
  dwellMs?: number;
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
    viewCount: number;
    totalDwellMs: number;
    addedToCart: boolean;
    removedFromCart: boolean;
  }>;
  cartAbandoned: Array<{
    productId: string;
    productName: string;
    removedAt: string;
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
    cartAbandoned: [],
    browsedFood: false,
    browsedDrinks: false,
    browsedDesserts: false,
    totalBrowseMs: 0,
    eventCount: 0,
  };
}
