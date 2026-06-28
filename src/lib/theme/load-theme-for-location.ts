import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { resolveTheme } from "@/lib/theme/theme-resolver";
import { parseThemeConfig } from "@/lib/theme/theme-config.schema";
import type { ResolvedTheme } from "@/lib/theme/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadThemeForLocation(
  locationId: string
): Promise<ResolvedTheme> {
  const admin = createAdminClient();

  const [{ data }, concierge] = await Promise.all([
    admin
      .from("locations")
      .select(
        "ai_concierge_config, organization:organizations(name, logo_url, ai_concierge_config)"
      )
      .eq("id", locationId)
      .maybeSingle(),
    loadConciergeConfigForLocation(locationId).catch(() => null),
  ]);

  const row = data as {
    ai_concierge_config?: unknown;
    organization?: {
      name: string;
      logo_url: string | null;
      ai_concierge_config?: unknown;
    } | null;
  } | null;

  const locationConfig =
    (row?.ai_concierge_config as Record<string, unknown> | undefined) ?? {};
  const orgConfig =
    (row?.organization?.ai_concierge_config as Record<string, unknown> | undefined) ??
    {};

  const themePartial =
    parseThemeConfig({ ...orgConfig, ...locationConfig }) ??
    parseThemeConfig(locationConfig);

  const brandPrimaryColor =
    typeof locationConfig.brandPrimaryColor === "string"
      ? locationConfig.brandPrimaryColor
      : null;

  return resolveTheme({
    orgName: row?.organization?.name ?? "Restaurant",
    logoUrl: row?.organization?.logo_url ?? null,
    displayName: concierge?.persona.name,
    theme: themePartial,
    brandPrimaryColor,
  });
}

export async function loadThemeForOrgLocation(input: {
  orgName: string;
  logoUrl?: string | null;
  locationId: string;
}): Promise<ResolvedTheme> {
  try {
    return await loadThemeForLocation(input.locationId);
  } catch {
    return resolveTheme({
      orgName: input.orgName,
      logoUrl: input.logoUrl,
    });
  }
}
