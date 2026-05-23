"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import {
  zOptionalSanitizedText,
  zUuid,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const upsellSchema = z
  .object({
    trigger_type: z.enum(["product", "category"]),
    trigger_product_id: zUuid().optional().nullable(),
    trigger_category_id: zUuid().optional().nullable(),
    suggest_product_id: zUuid(),
    message: zOptionalSanitizedText(500),
    is_active: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.trigger_type === "product" && !data.trigger_product_id) {
      ctx.addIssue({
        code: "custom",
        message: "Trigger product required",
        path: ["trigger_product_id"],
      });
    }
    if (data.trigger_type === "category" && !data.trigger_category_id) {
      ctx.addIssue({
        code: "custom",
        message: "Trigger category required",
        path: ["trigger_category_id"],
      });
    }
  });

function parseUpsellForm(formData: FormData) {
  const triggerType = formData.get("trigger_type");
  return upsellSchema.safeParse({
    trigger_type: triggerType,
    trigger_product_id:
      triggerType === "product" ? formData.get("trigger_product_id") : null,
    trigger_category_id:
      triggerType === "category" ? formData.get("trigger_category_id") : null,
    suggest_product_id: formData.get("suggest_product_id"),
    message: formData.get("message") || undefined,
    is_active: formData.get("is_active") === "on",
  });
}

export async function createUpsellRule(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const parsed = parseUpsellForm(formData);
  if (!parsed.success) return { error: "Neispravni podaci." };

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("upsell_rules")
    .select("sort_order")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const supabase = await createServerClient();
  const { error } = await supabase.from("upsell_rules").insert({
    location_id: locationId,
    trigger_product_id: parsed.data.trigger_product_id,
    trigger_category_id: parsed.data.trigger_category_id,
    suggest_product_id: parsed.data.suggest_product_id,
    message: parsed.data.message ?? null,
    sort_order: nextSort,
    is_active: parsed.data.is_active,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function updateUpsellRule(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = parseUpsellForm(formData);
  if (!parsed.success) return { error: "Neispravni podaci." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("upsell_rules")
    .update({
      trigger_product_id: parsed.data.trigger_product_id,
      trigger_category_id: parsed.data.trigger_category_id,
      suggest_product_id: parsed.data.suggest_product_id,
      message: parsed.data.message ?? null,
      is_active: parsed.data.is_active,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function deleteUpsellRule(id: string) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from("upsell_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function reorderUpsellRules(orderedIds: string[]) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const supabase = await createServerClient();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("upsell_rules")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("location_id", locationId);

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function toggleUpsellRule(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("upsell_rules")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/upsells");
  return { success: true };
}
