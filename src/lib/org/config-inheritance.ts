import type { Json } from "@/types/database";

export type OrgLevelDefaults = {
  orgId: string;
  orgName: string;
  currency: string;
  planId: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  defaultPlaybook: Json | null;
  platformFeePercent: number;
  platformFeeFixed: number;
};

export type LocationLevelOverrides = {
  locationId: string;
  locationName: string;
  timezone: string;
  defaultLocale: string | null;
  menuLocale: string | null;
  operatingHours: Json | null;
  aiPlaybook: string | null;
  locationPlaybook: Json | null;
  inPersonPayment: boolean;
};

export type EffectiveVenueConfig = {
  org: OrgLevelDefaults;
  location: LocationLevelOverrides;
  /** Location Denis config wins over org default playbook when set. */
  effectivePlaybook: Json | null;
};

export function resolveEffectiveVenueConfig(
  org: OrgLevelDefaults,
  location: LocationLevelOverrides
): EffectiveVenueConfig {
  const effectivePlaybook =
    location.locationPlaybook ?? org.defaultPlaybook ?? null;

  return { org, location, effectivePlaybook };
}

export function orgConfigFieldLabels(): Record<keyof OrgLevelDefaults, string> {
  return {
    orgId: "Organization ID",
    orgName: "Brand name",
    currency: "Currency",
    planId: "Billing plan",
    logoUrl: "Logo",
    coverImageUrl: "Cover image",
    defaultPlaybook: "Default Denis playbook",
    platformFeePercent: "Platform fee %",
    platformFeeFixed: "Platform fee fixed",
  };
}

export function locationConfigFieldLabels(): Record<
  keyof LocationLevelOverrides,
  string
> {
  return {
    locationId: "Location ID",
    locationName: "Venue name",
    timezone: "Timezone",
    defaultLocale: "Default locale",
    menuLocale: "Menu locale",
    operatingHours: "Operating hours",
    aiPlaybook: "Location playbook (text)",
    locationPlaybook: "Denis config override",
    inPersonPayment: "In-person payment",
  };
}
