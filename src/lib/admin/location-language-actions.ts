"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { isMenuLocale } from "@/lib/i18n/locale-config";
import type { MenuLocale } from "@/lib/i18n/translations";
import { createAdminClient } from "@/lib/supabase/admin";

const menuLocaleSchema = z.enum([
  "de",
  "sr",
  "tr",
  "hr",
  "ar",
  "fr",
  "es",
  "it",
  "ru",
]);

export async function updateLocationMenuLocale(menuLocale: MenuLocale) {
  const staff = await requireAdmin();
  const parsed = menuLocaleSchema.safeParse(menuLocale);

  if (!parsed.success || !isMenuLocale(parsed.data)) {
    return { error: "Invalid menu language." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("locations")
    .update({
      menu_locale: parsed.data,
      default_locale: parsed.data,
      available_locales: [parsed.data, "en"],
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

/** @deprecated Use updateLocationMenuLocale */
export async function updateLocationLanguages(input: {
  availableLocales: MenuLocale[];
  defaultLocale: MenuLocale;
}) {
  return updateLocationMenuLocale(input.defaultLocale);
}

const googleReviewUrlSchema = z.union([z.literal(""), z.string().url()]);

export async function updateLocationGoogleReviewUrl(googleReviewUrl: string) {
  const staff = await requireAdmin();
  const parsed = googleReviewUrlSchema.safeParse(googleReviewUrl.trim());

  if (!parsed.success) {
    return { error: "Enter a valid URL or leave the field empty." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();
  const normalized = parsed.data === "" ? null : parsed.data;

  const { error } = await admin
    .from("locations")
    .update({
      google_review_url: normalized,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateLocationOrderingEnabled(orderingEnabled: boolean) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("locations")
    .update({
      ordering_enabled: orderingEnabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
