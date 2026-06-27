"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  generateVenuePlaybook,
  type PlaybookInput,
  type PriceRange,
  type TonePreference,
  type VenueType,
} from "@/lib/admin/generate-venue-playbook";
import { loadPlaybookGenerationContext } from "@/lib/admin/load-playbook-generation-context";
import { invalidatePlaybookCache } from "@/lib/ai/playbook/invalidate-playbook-cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { sanitizeText } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const venueTypeSchema = z.enum([
  "restaurant",
  "bar",
  "cafe",
  "fast_food",
  "hotel",
  "lounge",
]);

const priceRangeSchema = z.enum(["budget", "mid", "premium"]);

const tonePreferenceSchema = z.enum(["relaxed", "formal", "luxury"]);

const wizardInputSchema = z.object({
  venueType: venueTypeSchema,
  tonePreference: tonePreferenceSchema,
  specialties: z.array(z.string().trim().min(1).max(120)).max(5),
  priceRange: priceRangeSchema,
  language: z.string().trim().min(2).max(10),
});

export type PlaybookWizardInput = z.infer<typeof wizardInputSchema>;

async function staffContext(locationIdOverride?: string) {
  const staff = await requireAdmin();
  const locationId =
    locationIdOverride?.trim() || (await getStaffLocationId(staff));
  if (!locationId) {
    return { error: "Location not found." as const };
  }
  return { staff, locationId };
}

export async function loadPlaybookWizardDefaults(locationIdOverride?: string) {
  const ctx = await staffContext(locationIdOverride);
  if ("error" in ctx) return ctx;

  const context = await loadPlaybookGenerationContext(
    ctx.staff.org_id,
    ctx.locationId
  );

  return {
    defaults: {
      venueName: context.venueName,
      menuSections: context.menuSections,
      topProducts: context.topProducts,
      language: context.language,
    },
  };
}

export async function previewVenuePlaybook(
  input: PlaybookWizardInput,
  locationIdOverride?: string
) {
  const ctx = await staffContext(locationIdOverride);
  if ("error" in ctx) return ctx;

  const parsed = wizardInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid playbook wizard input." };
  }

  const menuContext = await loadPlaybookGenerationContext(
    ctx.staff.org_id,
    ctx.locationId
  );

  const playbookInput: PlaybookInput = {
    venueName: menuContext.venueName,
    venueType: parsed.data.venueType as VenueType,
    menuSections: menuContext.menuSections,
    priceRange: parsed.data.priceRange as PriceRange,
    topProducts: menuContext.topProducts,
    specialties: parsed.data.specialties,
    language: parsed.data.language || menuContext.language,
    tonePreference: parsed.data.tonePreference as TonePreference,
  };

  const generated = generateVenuePlaybook(playbookInput);
  return {
    playbook: generated.playbook,
    tone: generated.tone,
    examples: generated.examples.map((row) => ({
      category: row.category,
      userMessage: row.user_message,
      assistantMessage: row.assistant_message,
    })),
  };
}

export async function applyGeneratedVenuePlaybook(input: PlaybookWizardInput) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const parsed = wizardInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid playbook wizard input." };
  }

  const menuContext = await loadPlaybookGenerationContext(
    ctx.staff.org_id,
    ctx.locationId
  );

  const playbookInput: PlaybookInput = {
    venueName: menuContext.venueName,
    venueType: parsed.data.venueType as VenueType,
    menuSections: menuContext.menuSections,
    priceRange: parsed.data.priceRange as PriceRange,
    topProducts: menuContext.topProducts,
    specialties: parsed.data.specialties,
    language: parsed.data.language || menuContext.language,
    tonePreference: parsed.data.tonePreference as TonePreference,
  };

  const generated = generateVenuePlaybook(playbookInput);
  const admin = createAdminClient();
  const sanitized = sanitizeText(generated.playbook, 4000);

  const { error: playbookError } = await admin
    .from("locations")
    .update({
      ai_playbook: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.locationId)
    .eq("org_id", ctx.staff.org_id);

  if (playbookError) return { error: playbookError.message };

  const { count } = await admin
    .from("ai_examples")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.staff.org_id)
    .eq("location_id", ctx.locationId);

  if ((count ?? 0) === 0 && generated.examples.length > 0) {
    const rows = generated.examples.map((example, index) => ({
      org_id: ctx.staff.org_id,
      location_id: ctx.locationId,
      category: example.category,
      user_message: example.user_message,
      assistant_message: example.assistant_message,
      assistant_json: example.assistant_json,
      sort_order: index + 1,
      is_active: true,
    }));

    const { error: examplesError } = await admin.from("ai_examples").insert(rows);
    if (examplesError) return { error: examplesError.message };
  }

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/locations");

  return {
    success: true,
    tone: generated.tone,
    playbook: sanitized,
  };
}

/** Apply generated playbook right after location creation (owner flow). */
export async function applyGeneratedVenuePlaybookForLocation(
  locationId: string,
  input: PlaybookWizardInput
) {
  const staff = await requireAdmin();
  if (!locationId?.trim()) return { error: "Invalid location." };

  const parsed = wizardInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid playbook wizard input." };
  }

  const menuContext = await loadPlaybookGenerationContext(
    staff.org_id,
    locationId
  );

  const playbookInput: PlaybookInput = {
    venueName: menuContext.venueName,
    venueType: parsed.data.venueType as VenueType,
    menuSections: menuContext.menuSections,
    priceRange: parsed.data.priceRange as PriceRange,
    topProducts: menuContext.topProducts,
    specialties: parsed.data.specialties,
    language: parsed.data.language || menuContext.language,
    tonePreference: parsed.data.tonePreference as TonePreference,
  };

  const generated = generateVenuePlaybook(playbookInput);
  const admin = createAdminClient();
  const sanitized = sanitizeText(generated.playbook, 4000);

  const { error } = await admin
    .from("locations")
    .update({
      ai_playbook: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locationId)
    .eq("org_id", staff.org_id);

  if (error) return { error: error.message };

  if (generated.examples.length > 0) {
    const rows = generated.examples.map((example, index) => ({
      org_id: staff.org_id,
      location_id: locationId,
      category: example.category,
      user_message: example.user_message,
      assistant_message: example.assistant_message,
      assistant_json: example.assistant_json,
      sort_order: index + 1,
      is_active: true,
    }));
    await admin.from("ai_examples").insert(rows);
  }

  await invalidatePlaybookCache(locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/locations");

  return { success: true, tone: generated.tone };
}
