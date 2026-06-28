export type LocationConciergeConfigRow = {
  menu_locale: string;
  ai_concierge_config: unknown;
  organization: {
    ai_concierge_config: unknown;
  } | null;
};

export type LocationVenueManifestRow = {
  venue_manifest: unknown;
  organization: {
    venue_manifest: unknown;
  } | null;
};

export type LocationCurrencyRow = {
  organization: { currency: string } | null;
};

export type AiGuestLocationRow = {
  id: string;
  org_id: string;
  menu_locale: string | null;
  default_locale: string | null;
  ai_concierge_enabled: boolean;
  organization: { id: string; name: string; feature_flags?: unknown } | null;
};

export type DenisWorldLocationRow = {
  ai_concierge_enabled: boolean;
  menu_locale: string | null;
  default_locale: string | null;
  organization: { id: string; slug: string; name: string };
};

export function parseLocationConciergeConfigRow(
  data: unknown
): LocationConciergeConfigRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid location concierge config row");
  }
  return data as LocationConciergeConfigRow;
}

export function parseLocationVenueManifestRow(
  data: unknown
): LocationVenueManifestRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid location venue manifest row");
  }
  return data as LocationVenueManifestRow;
}

export function parseLocationCurrencyRow(data: unknown): LocationCurrencyRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid location currency row");
  }
  return data as LocationCurrencyRow;
}

export function parseAiGuestLocationRow(data: unknown): AiGuestLocationRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid AI guest location row");
  }
  return data as AiGuestLocationRow;
}

export function parseDenisWorldLocationRow(
  data: unknown
): DenisWorldLocationRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Denis world location row");
  }
  return data as DenisWorldLocationRow;
}
