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
    return { error: "Neispravan jezik menija." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Lokacija nije pronađena." };
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
