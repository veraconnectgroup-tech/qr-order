"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import {
  zOptionalSanitizedText,
  zUuid,
} from "@/lib/security/zod-fields";
import { invalidateVenueKnowledgeGraphCache } from "@/lib/denis/kernel/vkg";
import { parseAbVariants } from "@/lib/upsell/rule-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const upsellSchema = z
  .object({
    rule_type: z.enum([
      "product_product",
      "category_product",
      "time_based",
      "cart_value",
      "guest_level",
    ]),
    trigger_product_id: zUuid().optional().nullable(),
    trigger_category_id: zUuid().optional().nullable(),
    suggest_product_id: zUuid(),
    message: zOptionalSanitizedText(500),
    after_hour: z.coerce.number().min(0).max(23).optional().nullable(),
    min_cart_euros: z.coerce.number().min(0).optional().nullable(),
    guest_tags: zOptionalSanitizedText(200),
    ab_message_b: zOptionalSanitizedText(500),
    is_active: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.rule_type === "product_product" && !data.trigger_product_id) {
      ctx.addIssue({
        code: "custom",
        message: "Trigger product required",
        path: ["trigger_product_id"],
      });
    }
    if (data.rule_type === "category_product" && !data.trigger_category_id) {
      ctx.addIssue({
        code: "custom",
        message: "Trigger category required",
        path: ["trigger_category_id"],
      });
    }
    if (data.rule_type === "time_based" && data.after_hour == null) {
      ctx.addIssue({
        code: "custom",
        message: "After hour required",
        path: ["after_hour"],
      });
    }
    if (data.rule_type === "cart_value" && !data.min_cart_euros) {
      ctx.addIssue({
        code: "custom",
        message: "Minimum cart value required",
        path: ["min_cart_euros"],
      });
    }
    if (
      data.rule_type === "guest_level" &&
      !(data.guest_tags?.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Guest tag required (e.g. vip)",
        path: ["guest_tags"],
      });
    }
  });

function parseUpsellForm(formData: FormData) {
  return upsellSchema.safeParse({
    rule_type: formData.get("rule_type") ?? "product_product",
    trigger_product_id:
      formData.get("rule_type") === "product_product"
        ? formData.get("trigger_product_id")
        : null,
    trigger_category_id:
      formData.get("rule_type") === "category_product"
        ? formData.get("trigger_category_id")
        : null,
    suggest_product_id: formData.get("suggest_product_id"),
    message: formData.get("message") || undefined,
    after_hour:
      formData.get("rule_type") === "time_based"
        ? formData.get("after_hour")
        : null,
    min_cart_euros:
      formData.get("rule_type") === "cart_value"
        ? formData.get("min_cart_euros")
        : null,
    guest_tags:
      formData.get("rule_type") === "guest_level"
        ? formData.get("guest_tags")
        : undefined,
    ab_message_b: formData.get("ab_message_b") || undefined,
    is_active: formData.get("is_active") === "on",
  });
}

function buildConditions(data: z.infer<typeof upsellSchema>) {
  if (data.rule_type === "time_based") {
    return { afterHour: data.after_hour ?? 18, beforeHour: 24 };
  }
  if (data.rule_type === "cart_value") {
    return { minCartEuros: data.min_cart_euros ?? 0 };
  }
  if (data.rule_type === "guest_level") {
    return {
      guestTags: (data.guest_tags ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    };
  }
  return {};
}

function buildAbVariants(data: z.infer<typeof upsellSchema>, existing?: unknown) {
  const variants = parseAbVariants(existing);
  const primary = data.message?.trim();
  const secondary = data.ab_message_b?.trim();
  const next: Array<{
    id: string;
    message: string;
    weight: number;
    impressions: number;
    conversions: number;
  }> = [];

  if (primary) {
    const existingA = variants.find((variant) => variant.id === "a");
    next.push({
      id: "a",
      message: primary,
      weight: 1,
      impressions: existingA?.impressions ?? 0,
      conversions: existingA?.conversions ?? 0,
    });
  }
  if (secondary) {
    const existingB = variants.find((variant) => variant.id === "b");
    next.push({
      id: "b",
      message: secondary,
      weight: 1,
      impressions: existingB?.impressions ?? 0,
      conversions: existingB?.conversions ?? 0,
    });
  }
  return next;
}

function rowFromParsed(data: z.infer<typeof upsellSchema>, existingAb?: unknown) {
  return {
    rule_type: data.rule_type,
    trigger_product_id:
      data.rule_type === "product_product" ? data.trigger_product_id : null,
    trigger_category_id:
      data.rule_type === "category_product" ? data.trigger_category_id : null,
    suggest_product_id: data.suggest_product_id,
    message: data.message ?? null,
    conditions: buildConditions(data),
    ab_variants: buildAbVariants(data, existingAb),
    is_active: data.is_active,
  };
}

export async function createUpsellRule(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const parsed = parseUpsellForm(formData);
  if (!parsed.success) return { error: "Invalid data." };

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
    sort_order: nextSort,
    ...rowFromParsed(parsed.data),
  });

  if (error) return { error: error.message };

  await invalidateVenueKnowledgeGraphCache(locationId);
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function updateUpsellRule(id: string, formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };
  const parsed = parseUpsellForm(formData);
  if (!parsed.success) return { error: "Invalid data." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("upsell_rules")
    .select("ab_variants")
    .eq("id", id)
    .maybeSingle();

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("upsell_rules")
    .update(rowFromParsed(parsed.data, (existing as { ab_variants?: unknown } | null)?.ab_variants))
    .eq("id", id);

  if (error) return { error: error.message };

  await invalidateVenueKnowledgeGraphCache(locationId);
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function deleteUpsellRule(id: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };
  const supabase = await createServerClient();
  const { error } = await supabase.from("upsell_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  await invalidateVenueKnowledgeGraphCache(locationId);
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function reorderUpsellRules(orderedIds: string[]) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const supabase = await createServerClient();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("upsell_rules")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("location_id", locationId);

    if (error) return { error: error.message };
  }

  await invalidateVenueKnowledgeGraphCache(locationId);
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function toggleUpsellRule(id: string, isActive: boolean) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("upsell_rules")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  await invalidateVenueKnowledgeGraphCache(locationId);
  revalidatePath("/admin/upsells");
  return { success: true };
}

export async function recordUpsellRuleEvent(
  ruleId: string,
  event: "impression" | "conversion" | "decline"
) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const column =
    event === "impression"
      ? "impressions_count"
      : event === "conversion"
        ? "conversions_count"
        : "declines_count";

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("upsell_rules")
    .select(column)
    .eq("id", ruleId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (!row) return { error: "Rule not found." };

  const current = (row as Record<string, number>)[column] ?? 0;
  const patch =
    event === "impression"
      ? { impressions_count: current + 1 }
      : event === "conversion"
        ? { conversions_count: current + 1 }
        : { declines_count: current + 1 };
  const { error } = await admin.from("upsell_rules").update(patch).eq("id", ruleId);

  if (error) return { error: error.message };
  revalidatePath("/admin/upsells");
  return { success: true };
}
