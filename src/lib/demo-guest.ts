import {
  DEMO_CURRENCY,
  DEMO_MENU_CATEGORIES,
  DEMO_TAX_PERCENT,
} from "@/components/landing/demo-data";

export const DEMO_GUEST_SLUG = "skyline-lounge";
export const DEMO_GUEST_TOKEN = "demo-table-8";

export function isDemoGuestRoute(slug: string, token: string) {
  return slug === DEMO_GUEST_SLUG && token === DEMO_GUEST_TOKEN;
}

/** Static demo menu when Supabase seed is not deployed yet. */
export function getDemoGuestMenuProps(slug: string, token: string) {
  return {
    slug,
    token,
    orgName: "Skyline Lounge",
    logoUrl: null as string | null,
    locationName: "Rooftop",
    tableName: "Table 8",
    zoneName: "Rooftop",
    categories: DEMO_MENU_CATEGORIES,
    taxPercent: DEMO_TAX_PERCENT,
    currency: DEMO_CURRENCY,
    locationId: "demo-location",
    tableId: "demo-table",
    orderingEnabled: true,
    timezone: "Europe/Berlin",
  };
}
