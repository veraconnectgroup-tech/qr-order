import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MenuView } from "@/components/guest/menu-view";
import {
  getDemoGuestMenuProps,
  isDemoGuestRoute,
} from "@/lib/demo-guest";
import type { Modifier, ModifierGroup, ProductWithModifiers } from "@/types";

type RawProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  prep_time_minutes: number | null;
  allergens: string[] | null;
  tags: string[] | null;
  modifier_groups?: (ModifierGroup & { modifiers: Modifier[] })[];
};

type RawCategory = {
  id: string;
  name: string;
  sort_order: number;
  products?: RawProduct[];
};

export default async function GuestMenuPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const isDemo = isDemoGuestRoute(slug, token);

  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    if (isDemo) {
      return <MenuView {...getDemoGuestMenuProps(slug, token)} />;
    }
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
        organization:organizations!inner(
          id,
          name,
          slug,
          logo_url,
          default_tax_percent,
          currency
        )
      )
    `
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .single();

  if (!tableData) {
    if (isDemo) {
      return <MenuView {...getDemoGuestMenuProps(slug, token)} />;
    }
    notFound();
  }

  const table = tableData as unknown as {
    id: string;
    name: string;
    location_id: string;
    zone: { name: string } | null;
    location: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        default_tax_percent: number;
        currency: string;
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
    .order("sort_order");

  const categories = ((categoriesData ?? []) as unknown as RawCategory[])
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      products: (cat.products ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (p): ProductWithModifiers => ({
            ...p,
            location_id: table.location_id,
            category_id: cat.id,
            name_en: null,
            description_en: null,
            prep_time_minutes: p.prep_time_minutes,
            allergens: p.allergens,
            tags: p.tags,
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
    />
  );
}
