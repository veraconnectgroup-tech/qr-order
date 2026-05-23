"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/locale-config";
import type { Locale } from "@/lib/i18n/translations";
import { createAdminClient } from "@/lib/supabase/admin";

const localeSchema = z.enum([
  "de",
  "en",
  "sr",
  "tr",
  "hr",
  "ar",
  "fr",
  "es",
  "it",
  "ru",
]);

const updateLanguagesSchema = z.object({
  availableLocales: z.array(localeSchema).min(1),
  defaultLocale: localeSchema,
});

export async function updateLocationLanguages(input: {
  availableLocales: Locale[];
  defaultLocale: Locale;
}) {
  const staff = await requireAdmin();
  const parsed = updateLanguagesSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Neispravan unos jezika." };
  }

  const { availableLocales, defaultLocale } = parsed.data;

  if (!availableLocales.includes(defaultLocale)) {
    return { error: "Podrazumevani jezik mora biti među dostupnim jezicima." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Lokacija nije pronađena." };
  }

  const admin = createAdminClient();
  const uniqueLocales = [...new Set(availableLocales)].filter(isLocale);

  const { error } = await admin
    .from("locations")
    .update({
      available_locales: uniqueLocales,
      default_locale: defaultLocale,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
