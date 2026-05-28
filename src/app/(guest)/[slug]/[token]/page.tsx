import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MenuView } from "@/components/guest/menu-view";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  getDemoGuestMenuProps,
  isDemoGuestRoute,
} from "@/lib/demo-guest";
import { getDemoAiRecommendations } from "@/lib/demo-ai";
import type { Modifier, ModifierGroup, ProductWithModifiers } from "@/types";
import { resolveProductImageUrl } from "@/lib/product-stock-images";

export const revalidate = 60;

type RawProduct = {
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
  modifier_groups?: (ModifierGroup & { modifiers: Modifier[] })[];
};

type RawCategory = {
  id: string;
  name: string;
  name_en: string | null;
  menu_section?: string | null;
  sort_order: number;
  schedule_enabled?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_days?: number[] | null;
  products?: RawProduct[];
};

export default async function GuestMenuPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  if (isDemoGuestRoute(slug, token)) {
    return <MenuView {...getDemoGuestMenuProps(slug, token)} />;
  }

  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    notFound();
  }

  const { data: tableData } = await supabase
    .from("tables")
    .select(
      `
      id,
      name,
      location_id,
      zone:zones(name),
      location:locations!inner(
        id,
        name,
        accepting_orders,
        ordering_enabled,
        ai_concierge_enabled,
        google_review_url,
        payment_online_enabled,
        payment_at_bar_enabled,
        payment_card_at_table_enabled,
        timezone,
        organization:organizations!inner(
          id,
          name,
          slug,
          logo_url,
          default_tax_percent,
          currency,
          stripe_onboarded
        )
      )
    `
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!tableData) notFound();

  const table = tableData as unknown as {
    id: string;
    name: string;
    location_id: string;
    zone: { name: string } | null;
      location: {
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
      organization: {
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        default_tax_percent: number;
        currency: string;
        stripe_onboarded: boolean;
      };
    };
  };

  const org = table.location.organization;
  if (org.slug !== slug) notFound();

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("*, products(*, modifier_groups(*, modifiers(*)))")
    .eq("location_id", table.location_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");

  const categories = ((categoriesData ?? []) as unknown as RawCategory[])
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      name_en: cat.name_en,
      menu_section: cat.menu_section ?? null,
      schedule_enabled: cat.schedule_enabled ?? false,
      schedule_start: cat.schedule_start ?? null,
      schedule_end: cat.schedule_end ?? null,
      schedule_days: cat.schedule_days ?? [1, 2, 3, 4, 5, 6, 0],
      products: (cat.products ?? [])
        .filter((p) => !p.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (p): ProductWithModifiers => ({
            ...p,
            image_url: resolveProductImageUrl({
              id: p.id,
              name: p.name,
              image_url: p.image_url,
            }),
            location_id: table.location_id,
            category_id: cat.id,
            prep_time_minutes: p.prep_time_minutes,
            allergens: p.allergens,
            tags: p.tags,
            requires_serve_size: p.requires_serve_size ?? false,
            serve_size_presets: p.serve_size_presets ?? null,
            allow_custom_serve_size: p.allow_custom_serve_size ?? true,
            tax_rate: p.tax_rate ?? null,
            ai_description: p.ai_description ?? null,
            deleted_at: p.deleted_at ?? null,
            created_at: "",
            updated_at: "",
            modifier_groups: (p.modifier_groups ?? [])
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((g) => ({
                ...g,
                modifiers: (g.modifiers ?? [])
                  .filter((m) => m.is_available)
                  .sort((a, b) => a.sort_order - b.sort_order),
              })),
          })
        ),
    }))
    .filter((c) => c.products.length > 0);

  const conciergeConfig = await loadConciergeConfigForLocation(table.location_id);

  return (
    <MenuView
      slug={slug}
      token={token}
      orgName={org.name}
      logoUrl={org.logo_url}
      locationName={table.location.name}
      tableName={table.name}
      zoneName={table.zone?.name ?? null}
      categories={categories}
      taxPercent={Number(org.default_tax_percent)}
      currency={org.currency}
      locationId={table.location_id}
      tableId={table.id}
      timezone={table.location.timezone ?? "Europe/Berlin"}
      orderingEnabled={table.location.ordering_enabled}
      acceptingOrders={table.location.accepting_orders}
      aiConciergeEnabled={table.location.ai_concierge_enabled}
      returnGuestEnabled={conciergeConfig.memory.returnGuestEnabled}
      memoryConsentPrompt={conciergeConfig.memory.consentPromptTemplate}
      voiceEnabled={conciergeConfig.surfaces.voiceEnabled}
      voiceTtsEnabled={conciergeConfig.surfaces.voiceTtsEnabled}
      googleReviewUrl={table.location.google_review_url}
      stripeOnboarded={org.stripe_onboarded}
      paymentOnlineEnabled={table.location.payment_online_enabled}
      paymentAtBarEnabled={table.location.payment_at_bar_enabled}
      paymentCardAtTableEnabled={table.location.payment_card_at_table_enabled}
    />
  );
}
