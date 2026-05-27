import type { Json } from "@/types/database";

export const PLATFORM_FEATURES = [
  "ai_concierge",
  "split_payments",
  "fiscal",
  "multi_location",
  "api_access",
] as const;

export type PlatformFeature = (typeof PLATFORM_FEATURES)[number];

export const FEATURE_LABELS: Record<PlatformFeature, string> = {
  ai_concierge: "Denis",
  split_payments: "Split payments",
  fiscal: "Fiscal / TSE",
  multi_location: "Multi-location",
  api_access: "API access",
};

export function parseFeatureFlags(raw: Json | null | undefined): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, boolean>;
}

/** Returns true when flag is enabled. Missing flags default to enabled (legacy orgs). */
export function hasFeature(
  org: { feature_flags?: Json | null },
  flag: PlatformFeature
): boolean {
  const flags = parseFeatureFlags(org.feature_flags);
  if (!(flag in flags)) return true;
  return flags[flag] === true;
}
