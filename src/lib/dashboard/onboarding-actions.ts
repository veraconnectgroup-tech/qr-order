"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { notifyNewOrgGoingLive } from "@/lib/platform/notify-new-org";
import {
  zOptionalSanitizedText,
  zSanitizedText,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionError = { error: string };
type OwnerContext = {
  staff: Awaited<ReturnType<typeof requireStaff>>;
  locationId: string;
};

const venueSchema = z.object({
  orgName: zSanitizedText(200).pipe(z.string().min(2)),
  address: zOptionalSanitizedText(500),
  city: zOptionalSanitizedText(120),
  postalCode: zOptionalSanitizedText(20),
  timezone: zSanitizedText(80).pipe(z.string().min(1)),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).optional(),
  logoUrl: zOptionalSanitizedText(2000),
});

const brandingSchema = z.object({
  logoUrl: zOptionalSanitizedText(2000),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .optional(),
});

const menuImportItemSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  description: zOptionalSanitizedText(1000),
  price: z.coerce.number().positive(),
  category: zSanitizedText(120).pipe(z.string().min(1)),
  allergens: z.array(zSanitizedText(80)).optional(),
});

const denisConfigSchema = z.object({
  playbookPackId: zOptionalSanitizedText(80),
  menuLocale: z.enum(["de", "en", "sr"]).optional(),
  tone: z
    .enum(["efficient", "formal", "friendly", "playful_luxury"])
    .optional(),
});

const productInputSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  price: z.coerce.number().positive(),
  categoryId: z.string().uuid(),
});

function requireOwnerOrManager() {
  return requireStaff().then((staff) => {
    if (!["owner", "manager"].includes(staff.role)) {
      return { error: "Not allowed." as const };
    }
    return { staff };
  });
}

async function getOwnerContext(): Promise<ActionError | OwnerContext> {
  const auth = await requireOwnerOrManager();
  if ("error" in auth) return { error: auth.error ?? "Not allowed." };
  const locationId = await getStaffLocationId(auth.staff);
  if (!locationId) return { error: "Location not found." };
  return { staff: auth.staff, locationId };
}

async function ensureDefaultZone(locationId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("zones")
    .select("id")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: zone, error } = await admin
    .from("zones")
    .insert({
      location_id: locationId,
      name: "Main",
      sort_order: 0,
    } as never)
    .select("id")
    .single();

  if (error || !zone) throw new Error(error?.message ?? "Could not create zone.");
  return (zone as { id: string }).id;
}

export async function saveOnboardingVenue(input: {
  orgName: string;
  address?: string;
  city?: string;
  postalCode?: string;
  timezone: string;
  currency?: string;
  logoUrl?: string;
}) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid venue details." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: orgError } = await admin
    .from("organizations")
    .update({
      name: parsed.data.orgName,
      logo_url: parsed.data.logoUrl || null,
      currency: parsed.data.currency ?? undefined,
      updated_at: now,
    })
    .eq("id", ctx.staff.org_id);

  if (orgError) return { error: orgError.message };

  const { error: locError } = await admin
    .from("locations")
    .update({
      name: parsed.data.orgName,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      postal_code: parsed.data.postalCode ?? null,
      timezone: parsed.data.timezone,
      updated_at: now,
    })
    .eq("id", ctx.locationId);

  if (locError) return { error: locError.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveOnboardingBranding(input: {
  logoUrl?: string;
  primaryColor?: string;
}) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid branding details." };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const color = parsed.data.primaryColor
    ? parsed.data.primaryColor.startsWith("#")
      ? parsed.data.primaryColor
      : `#${parsed.data.primaryColor}`
    : null;

  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", ctx.locationId)
    .maybeSingle();

  const existingConfig =
    ((locationRow as { ai_concierge_config?: Record<string, unknown> } | null)
      ?.ai_concierge_config ?? {}) as Record<string, unknown>;

  const [{ error: orgError }, { error: locError }] = await Promise.all([
    admin
      .from("organizations")
      .update({
        logo_url: parsed.data.logoUrl || null,
        updated_at: now,
      })
      .eq("id", ctx.staff.org_id),
    admin
      .from("locations")
      .update({
        ai_concierge_config: {
          ...existingConfig,
          brandPrimaryColor: color,
          theme: {
            ...(typeof existingConfig.theme === "object" && existingConfig.theme
              ? (existingConfig.theme as Record<string, unknown>)
              : {}),
            ...(color ? { primaryColor: color } : {}),
          },
        },
        updated_at: now,
      })
      .eq("id", ctx.locationId),
  ]);

  if (orgError) return { error: orgError.message };
  if (locError) return { error: locError.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function saveOnboardingProducts(
  products: Array<{ name: string; price: number; categoryId: string }>
) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = z.array(productInputSchema).min(1).max(200).safeParse(products);
  if (!parsed.success) return { error: "Add at least one product." };

  return persistOnboardingProducts(ctx.locationId, parsed.data);
}

export async function saveOnboardingMenuImport(
  items: Array<{
    name: string;
    description?: string | null;
    price: number;
    category: string;
    allergens?: string[];
  }>
) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = z.array(menuImportItemSchema).min(1).max(200).safeParse(items);
  if (!parsed.success) return { error: "Invalid menu import." };

  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("categories")
    .select("id, name, menu_section")
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null);

  const categoryRows = (categories ?? []) as Array<{
    id: string;
    name: string;
    menu_section: string;
  }>;

  const { inferMenuSection } = await import("@/lib/menu-import/normalize-category");
  const categoryIdByLabel = new Map<string, string>();

  for (const row of categoryRows) {
    categoryIdByLabel.set(row.name.toLowerCase(), row.id);
    categoryIdByLabel.set(row.menu_section.toLowerCase(), row.id);
  }

  const resolvedProducts: Array<{
    name: string;
    price: number;
    categoryId: string;
  }> = [];

  for (const item of parsed.data) {
    const label = item.category.trim();
    let categoryId =
      categoryIdByLabel.get(label.toLowerCase()) ??
      categoryIdByLabel.get(inferMenuSection(label));

    if (!categoryId) {
      const section = inferMenuSection(label);
      const { data: created, error } = await admin
        .from("categories")
        .insert({
          location_id: ctx.locationId,
          name: label,
          name_en: label,
          menu_section: section,
          sort_order: categoryRows.length + categoryIdByLabel.size,
        } as never)
        .select("id, name, menu_section")
        .single();

      if (error || !created) {
        return { error: error?.message ?? "Could not create category." };
      }

      categoryId = (created as { id: string }).id;
      categoryIdByLabel.set(label.toLowerCase(), categoryId);
      categoryIdByLabel.set(section, categoryId);
    }

    resolvedProducts.push({
      name: item.name,
      price: item.price,
      categoryId,
    });
  }

  return persistOnboardingProducts(ctx.locationId, resolvedProducts);
}

async function persistOnboardingProducts(
  locationId: string,
  products: Array<{ name: string; price: number; categoryId: string }>
) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("location_id", locationId)
    .is("deleted_at", null);

  const existingIds = (existing ?? []).map((row) => (row as { id: string }).id);
  if (existingIds.length) {
    await admin
      .from("products")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", existingIds);
  }

  const { error } = await admin.from("products").insert(
    products.map((item) => ({
      location_id: locationId,
      category_id: item.categoryId,
      name: item.name,
      price: item.price,
      is_available: true,
    })) as never
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true, count: products.length };
}

export async function saveOnboardingTables(tableNames: string[]) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const names = tableNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (!names.length) return { error: "Add at least one table." };

  const admin = createAdminClient();
  const zoneId = await ensureDefaultZone(ctx.locationId);

  const { data: existing } = await admin
    .from("tables")
    .select("id")
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null);

  const existingIds = (existing ?? []).map((row) => (row as { id: string }).id);
  if (existingIds.length) {
    await admin
      .from("tables")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", existingIds);
  }

  const { data: inserted, error } = await admin
    .from("tables")
    .insert(
      names.map((name) => ({
        location_id: ctx.locationId,
        zone_id: zoneId,
        name,
        seats: 4,
      })) as never
    )
    .select("id, name, qr_token")
    .returns<Array<{ id: string; name: string; qr_token: string }>>();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true, tables: inserted ?? [] };
}

export async function skipOnboardingPayment() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      payment_online_enabled: false,
      payment_at_bar_enabled: true,
      payment_card_at_table_enabled: false,
      in_person_payment_location: "bar",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function saveOnboardingDenisConfig(input: {
  playbookPackId?: string;
  menuLocale?: "de" | "en" | "sr";
  tone?: "efficient" | "formal" | "friendly" | "playful_luxury";
}) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = denisConfigSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid Denis configuration." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { generateVenuePlaybook } = await import(
    "@/lib/admin/generate-venue-playbook"
  );
  const { resolvePlaybookPackDefinition } = await import(
    "@/lib/denis/cognition/manifest/playbook-pack-registry"
  );

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, ai_concierge_config")
    .eq("id", ctx.staff.org_id)
    .maybeSingle();

  const orgName =
    (orgRow as { name?: string } | null)?.name?.trim() || "Restaurant";
  const pack = resolvePlaybookPackDefinition(parsed.data.playbookPackId ?? null);
  const generated = generateVenuePlaybook({
    venueName: orgName,
    venueType: "restaurant",
    menuSections: ["Food", "Drinks", "Desserts"],
    tonePreference: parsed.data.tone ?? null,
    language: parsed.data.menuLocale ?? "de",
  });

  const playbook = pack?.playbook ?? generated.playbook;

  const orgConfig =
    ((orgRow as { ai_concierge_config?: Record<string, unknown> } | null)
      ?.ai_concierge_config ?? {}) as Record<string, unknown>;

  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", ctx.locationId)
    .maybeSingle();

  const locationConfig =
    ((locationRow as { ai_concierge_config?: Record<string, unknown> } | null)
      ?.ai_concierge_config ?? {}) as Record<string, unknown>;

  const [{ error: orgError }, { error: locError }] = await Promise.all([
    admin
      .from("organizations")
      .update({
        ai_concierge_config: {
          ...orgConfig,
          playbookPackId: parsed.data.playbookPackId ?? null,
        },
        updated_at: now,
      })
      .eq("id", ctx.staff.org_id),
    admin
      .from("locations")
      .update({
        ai_playbook: playbook,
        menu_locale:
          parsed.data.menuLocale && parsed.data.menuLocale !== "en"
            ? parsed.data.menuLocale
            : undefined,
        default_locale: parsed.data.menuLocale ?? undefined,
        ai_concierge_config: {
          ...locationConfig,
          tone: parsed.data.tone ?? generated.tone,
        },
        updated_at: now,
      })
      .eq("id", ctx.locationId),
  ]);

  if (orgError) return { error: orgError.message };
  if (locError) return { error: locError.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function extractOnboardingMenuFromText(ocrText: string) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const trimmed = ocrText.trim();
  if (!trimmed) return { error: "Paste menu text or upload a photo." };

  const { parseMenuFromOcrText, parseMenuFromLlmJson, MENU_OCR_LLM_SYSTEM_PROMPT } =
    await import("@/lib/menu-import/extract-menu-ocr");

  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("categories")
    .select("id, name, menu_section")
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null);

  const categoryHints = (categories ?? []) as Array<{
    id: string;
    name: string;
    menu_section: string;
  }>;

  const heuristic = parseMenuFromOcrText(trimmed, categoryHints);
  if (heuristic.items.length >= 1) {
    return { success: true, ...heuristic, source: "heuristic" as const };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { error: "Could not extract menu items.", warnings: heuristic.warnings };
  }

  try {
    const { callOpenAiChat } = await import("@/lib/ai/openai-client");
    const result = await callOpenAiChat([
      { role: "system", content: MENU_OCR_LLM_SYSTEM_PROMPT },
      { role: "user", content: trimmed.slice(0, 12_000) },
    ]);
    const llmParsed = parseMenuFromLlmJson(result.content, categoryHints);
    if (!llmParsed.items.length) {
      return { error: "Could not extract menu items.", warnings: llmParsed.warnings };
    }
    return { success: true, ...llmParsed, source: "llm" as const };
  } catch (error) {
    logger.warn("Menu OCR LLM extraction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Menu extraction failed.", warnings: heuristic.warnings };
  }
}

export async function saveOnboardingProgress(progress: {
  completedSteps: string[];
  skippedSteps: string[];
}) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("ai_concierge_config")
    .eq("id", ctx.staff.org_id)
    .maybeSingle();

  const existing =
    ((orgRow as { ai_concierge_config?: Record<string, unknown> } | null)
      ?.ai_concierge_config ?? {}) as Record<string, unknown>;

  const { error } = await admin
    .from("organizations")
    .update({
      ai_concierge_config: {
        ...existing,
        onboardingProgress: progress,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.staff.org_id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveOnboardingFiscal(
  steuernummer: string,
  ustIdNr: string
) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      steuernummer: steuernummer.trim() || null,
      ust_id_nr: ustIdNr.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.staff.org_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function completeOnboarding() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [{ error: orgError }, { error: locError }] = await Promise.all([
    admin
      .from("organizations")
      .update({ onboarding_completed: true, updated_at: now })
      .eq("id", ctx.staff.org_id),
    admin
      .from("locations")
      .update({
        accepting_orders: true,
        is_active: true,
        updated_at: now,
      })
      .eq("id", ctx.locationId),
  ]);

  if (orgError) return { error: orgError.message };
  if (locError) return { error: locError.message };

  void notifyNewOrgGoingLive(ctx.staff.org_id, ctx.locationId).catch((error) => {
    logger.warn("Platform new-org notification failed", {
      orgId: ctx.staff.org_id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  revalidatePath("/", "layout");
  redirect("/dashboard/orders");
}
