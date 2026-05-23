"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { zSanitizedText, zUuid } from "@/lib/security/zod-fields";
import { createServerClient } from "@/lib/supabase/server";

const promoSchema = z.object({
  code: zSanitizedText(50).pipe(z.string().min(1)),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().positive(),
  min_order_amount: z.coerce.number().min(0).default(0),
  max_uses: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  valid_from: z.string().optional(),
  valid_until: z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  is_active: z.coerce.boolean().default(true),
});

function parsePromoForm(formData: FormData) {
  return promoSchema.safeParse({
    code: formData.get("code"),
    discount_type: formData.get("discount_type"),
    discount_value: formData.get("discount_value"),
    min_order_amount: formData.get("min_order_amount") || 0,
    max_uses: formData.get("max_uses") || null,
    valid_from: formData.get("valid_from") || undefined,
    valid_until: formData.get("valid_until") || null,
    is_active: formData.get("is_active") === "on",
  });
}

export async function createPromoCode(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const parsed = parsePromoForm(formData);
  if (!parsed.success) return { error: "Neispravni podaci." };

  if (
    parsed.data.discount_type === "percent" &&
    parsed.data.discount_value > 100
  ) {
    return { error: "Procenat popusta ne može biti veći od 100." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("promo_codes").insert({
    location_id: locationId,
    code: parsed.data.code.trim().toUpperCase(),
    discount_type: parsed.data.discount_type,
    discount_value: parsed.data.discount_value,
    min_order_amount: parsed.data.min_order_amount,
    max_uses: parsed.data.max_uses,
    valid_from: parsed.data.valid_from ?? new Date().toISOString(),
    valid_until: parsed.data.valid_until,
    is_active: parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Kod već postoji za ovu lokaciju." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/promos");
  return { success: true };
}

export async function updatePromoCode(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = parsePromoForm(formData);
  if (!parsed.success) return { error: "Neispravni podaci." };

  if (
    parsed.data.discount_type === "percent" &&
    parsed.data.discount_value > 100
  ) {
    return { error: "Procenat popusta ne može biti veći od 100." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("promo_codes")
    .update({
      code: parsed.data.code.trim().toUpperCase(),
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      min_order_amount: parsed.data.min_order_amount,
      max_uses: parsed.data.max_uses,
      valid_from: parsed.data.valid_from ?? new Date().toISOString(),
      valid_until: parsed.data.valid_until,
      is_active: parsed.data.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Kod već postoji za ovu lokaciju." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/promos");
  return { success: true };
}

export async function deletePromoCode(id: string) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  return { success: true };
}

export async function togglePromoCode(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  return { success: true };
}
