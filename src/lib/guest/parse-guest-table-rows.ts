import type { Modifier, ModifierGroup } from "@/types";

export type GuestOrganizationRow = {
  id?: string;
  name?: string;
  slug: string;
  logo_url?: string | null;
  default_tax_percent?: number | null;
  currency?: string;
  stripe_onboarded?: boolean;
};

export type GuestLocationMenuRow = {
  id: string;
  name: string;
  accepting_orders: boolean;
  ordering_enabled: boolean;
  ai_concierge_enabled: boolean;
  google_review_url: string | null;
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
  timezone: string;
  organization: GuestOrganizationRow & {
    id: string;
    name: string;
    default_tax_percent: number;
    currency: string;
    stripe_onboarded: boolean;
  };
};

export type GuestMenuTableRow = {
  id: string;
  name: string;
  location_id: string;
  zone: { name: string } | null;
  location: GuestLocationMenuRow;
};

export type GuestLayoutTableRow = {
  location_id: string;
  location: {
    id: string;
    menu_locale: string | null;
    default_locale: string | null;
    organization: { slug: string; name: string; logo_url: string | null };
  };
};

export type GuestCartTableRow = {
  name: string;
  location_id: string;
  location: { accepting_orders: boolean; ordering_enabled: boolean };
};

export type GuestCheckoutTableRow = {
  location_id: string;
  location: {
    ordering_enabled: boolean;
    accepting_orders: boolean;
    organization: {
      slug: string;
      default_tax_percent: number;
      currency: string;
    };
  };
};

export type GuestOrderPageTableRow = {
  id: string;
  location: {
    id: string;
    ai_concierge_enabled: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    google_review_url: string | null;
    organization: {
      slug: string;
      currency: string;
      stripe_onboarded: boolean;
      default_tax_percent: number | null;
    };
  };
};

export type GuestMenuProductRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  prep_time_minutes: number | null;
  allergens: string[] | null;
  tags: string[] | null;
  requires_serve_size?: boolean;
  serve_size_presets?: string[] | null;
  allow_custom_serve_size?: boolean;
  tax_rate?: number | null;
  ai_description?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  modifier_groups?: (ModifierGroup & { modifiers: Modifier[] })[];
};

export type GuestMenuCategoryRow = {
  id: string;
  name: string;
  name_en: string | null;
  menu_section?: string | null;
  sort_order: number;
  schedule_enabled?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_days?: number[] | null;
  products?: GuestMenuProductRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGuestMenuTable(data: unknown): GuestMenuTableRow | null {
  if (!isRecord(data)) return null;
  const row = data as GuestMenuTableRow;
  if (!row.id || !row.location?.organization?.slug) return null;
  return row;
}

export function parseGuestLayoutTable(data: unknown): GuestLayoutTableRow | null {
  if (!isRecord(data)) return null;
  const row = data as GuestLayoutTableRow;
  if (!row.location?.organization?.slug) return null;
  return row;
}

export function parseGuestCartTable(data: unknown): GuestCartTableRow | null {
  if (!isRecord(data)) return null;
  const row = data as GuestCartTableRow;
  if (!row.name || !row.location_id || !row.location) return null;
  return row;
}

export function parseGuestCheckoutTable(
  data: unknown
): GuestCheckoutTableRow | null {
  if (!isRecord(data)) return null;
  const row = data as GuestCheckoutTableRow;
  if (!row.location_id || !row.location?.organization?.slug) return null;
  return row;
}

export function parseGuestOrderPageTable(
  data: unknown
): GuestOrderPageTableRow | null {
  if (!isRecord(data)) return null;
  const row = data as GuestOrderPageTableRow;
  if (!row.id || !row.location?.organization?.slug) return null;
  return row;
}

export function parseGuestSplitOrgSlug(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const row = data as {
    location?: { organization?: { slug?: string } };
  };
  return row.location?.organization?.slug ?? null;
}

export function parseGuestMenuCategories(data: unknown): GuestMenuCategoryRow[] {
  if (!Array.isArray(data)) return [];
  return data as GuestMenuCategoryRow[];
}
