import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  getVenueTemplate,
  type VenueTemplate,
} from "@/lib/venue-templates/template-registry";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProvisionVenueInput = {
  orgId: string;
  orgSlug: string;
  template: VenueTemplate;
  locationName: string;
  currency: string;
  timezone: string;
  language: string;
};

export type ProvisionVenueResult = {
  locationId: string;
  qrUrl: string;
  dashboardUrl: string;
  menuSectionIds: string[];
};

export async function provisionVenueFromTemplate(
  admin: SupabaseClient,
  input: ProvisionVenueInput
): Promise<ProvisionVenueResult> {
  const config = mergePartialConciergeConfig(null, {
    ...input.template.defaults,
    language: {
      ...input.template.defaults.language,
      venueDefault: input.language,
      followGuest: true,
      fallbackWhenUnknown: "english",
    },
  });

  const { data: locationRow, error: locationError } = await admin
    .from("locations")
    .insert({
      org_id: input.orgId,
      name: input.locationName,
      is_active: true,
      ai_concierge_enabled: true,
      ai_concierge_config: config,
      timezone: input.timezone,
      default_locale: input.language,
    } as never)
    .select("id")
    .single();

  if (locationError || !locationRow) {
    throw new Error(locationError?.message ?? "Could not create location.");
  }

  const locationId = (locationRow as { id: string }).id;
  const menuSectionIds: string[] = [];

  for (const [index, sectionName] of input.template.suggestedMenuSections.entries()) {
    const { data: categoryRow, error: categoryError } = await admin
      .from("categories")
      .insert({
        location_id: locationId,
        name: sectionName,
        sort_order: index,
        is_active: true,
      } as never)
      .select("id")
      .single();

    if (categoryError || !categoryRow) {
      throw new Error(categoryError?.message ?? "Could not create menu section.");
    }
    menuSectionIds.push((categoryRow as { id: string }).id);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://order.example.com";

  return {
    locationId,
    qrUrl: `${baseUrl}/${input.orgSlug}/waitlist`,
    dashboardUrl: `${baseUrl}/dashboard`,
    menuSectionIds,
  };
}

/** Apply template defaults to an existing location (onboarding). */
export async function applyVenueTemplateToLocation(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    templateId: string;
    language?: string;
  }
): Promise<{ menuSectionIds: string[] }> {
  const template = getVenueTemplate(input.templateId);
  if (!template) {
    throw new Error(`Unknown venue template: ${input.templateId}`);
  }

  const { data: locationRow, error: locationError } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (locationError || !locationRow) {
    throw new Error("Location not found.");
  }

  const config = mergePartialConciergeConfig(null, {
    ...template.defaults,
    language: {
      ...template.defaults.language,
      venueDefault: input.language ?? template.defaults.language?.venueDefault ?? "de",
      followGuest: true,
      fallbackWhenUnknown: "english",
    },
  });

  await admin
    .from("locations")
    .update({
      ai_concierge_enabled: true,
      ai_concierge_config: config as never,
      default_locale: input.language ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.locationId);

  const { count: existingCategories } = await admin
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("location_id", input.locationId);

  const menuSectionIds: string[] = [];
  if ((existingCategories ?? 0) === 0) {
    for (const [index, sectionName] of template.suggestedMenuSections.entries()) {
      const { data: categoryRow, error: categoryError } = await admin
        .from("categories")
        .insert({
          location_id: input.locationId,
          name: sectionName,
          sort_order: index,
          is_active: true,
        } as never)
        .select("id")
        .single();

      if (categoryError || !categoryRow) {
        throw new Error(categoryError?.message ?? "Could not create menu section.");
      }
      menuSectionIds.push((categoryRow as { id: string }).id);
    }
  }

  return { menuSectionIds };
}

export async function provisionVenueFromTemplateId(
  admin: SupabaseClient,
  input: Omit<ProvisionVenueInput, "template"> & { templateId: string }
): Promise<ProvisionVenueResult> {
  const template = getVenueTemplate(input.templateId);
  if (!template) {
    throw new Error(`Unknown venue template: ${input.templateId}`);
  }
  return provisionVenueFromTemplate(admin, {
    ...input,
    template,
  });
}
