"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_CONFIG } from "@/lib/ai/config";
import {
  DEFAULT_AI_EXAMPLES,
  DEFAULT_AI_PLAYBOOK,
} from "@/lib/ai/playbook/default-examples";
import { invalidatePlaybookCache } from "@/lib/ai/playbook/invalidate-playbook-cache";
import type { AiExampleCategory } from "@/lib/ai/playbook/types";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { sanitizeText } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const categorySchema = z.enum([
  "order",
  "recommend",
  "clarify",
  "confirm",
  "general",
]);

const exampleSchema = z.object({
  category: categorySchema,
  userMessage: z.string().trim().min(1).max(500),
  assistantMessage: z.string().trim().min(1).max(2000),
});

async function staffContext() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." as const };
  }
  return { staff, locationId };
}

export async function updateAiPlaybook(playbook: string) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const sanitized = sanitizeText(playbook, 4000);

  const { error } = await admin
    .from("locations")
    .update({
      ai_playbook: sanitized || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.locationId)
    .eq("org_id", ctx.staff.org_id);

  if (error) return { error: error.message };

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function createAiExample(input: {
  category: AiExampleCategory;
  userMessage: string;
  assistantMessage: string;
}) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const parsed = exampleSchema.safeParse({
    category: input.category,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
  });
  if (!parsed.success) {
    return { error: "Invalid example." };
  }

  const admin = createAdminClient();

  const { count } = await admin
    .from("ai_examples")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.staff.org_id)
    .eq("location_id", ctx.locationId)
    .eq("is_active", true);

  if ((count ?? 0) >= AI_CONFIG.maxPlaybookExamples) {
    return { error: `Maximum ${AI_CONFIG.maxPlaybookExamples} active examples per location.` };
  }

  const { data: maxRow } = await admin
    .from("ai_examples")
    .select("sort_order")
    .eq("location_id", ctx.locationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { error } = await admin.from("ai_examples").insert({
    org_id: ctx.staff.org_id,
    location_id: ctx.locationId,
    category: parsed.data.category,
    user_message: sanitizeText(parsed.data.userMessage, 500),
    assistant_message: sanitizeText(parsed.data.assistantMessage, 2000),
    sort_order: sortOrder,
    is_active: true,
  });

  if (error) return { error: error.message };

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteAiExample(exampleId: string) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_examples")
    .delete()
    .eq("id", exampleId)
    .eq("org_id", ctx.staff.org_id)
    .eq("location_id", ctx.locationId);

  if (error) return { error: error.message };

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleAiExample(exampleId: string, isActive: boolean) {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_examples")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", exampleId)
    .eq("org_id", ctx.staff.org_id)
    .eq("location_id", ctx.locationId);

  if (error) return { error: error.message };

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function seedDefaultAiPlaybook() {
  const ctx = await staffContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();

  const [{ count }, { data: location }] = await Promise.all([
    admin
      .from("ai_examples")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.staff.org_id)
      .eq("location_id", ctx.locationId),
    admin
      .from("locations")
      .select("ai_playbook")
      .eq("id", ctx.locationId)
      .single(),
  ]);

  if ((count ?? 0) > 0) {
    return { error: "Primeri već postoje za ovu lokaciju." };
  }

  const locationRow = location as { ai_playbook: string | null } | null;
  if (!locationRow?.ai_playbook?.trim()) {
    const { error: playbookError } = await admin
      .from("locations")
      .update({
        ai_playbook: DEFAULT_AI_PLAYBOOK,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.locationId)
      .eq("org_id", ctx.staff.org_id);

    if (playbookError) return { error: playbookError.message };
  }

  const rows = DEFAULT_AI_EXAMPLES.map((example, index) => ({
    org_id: ctx.staff.org_id,
    location_id: ctx.locationId,
    category: example.category,
    user_message: example.userMessage,
    assistant_message: example.assistantMessage,
    assistant_json: example.assistantJson ?? null,
    sort_order: index + 1,
    is_active: true,
  }));

  const { error } = await admin.from("ai_examples").insert(rows);
  if (error) return { error: error.message };

  await invalidatePlaybookCache(ctx.locationId);
  revalidatePath("/admin/settings");
  return { success: true, seeded: rows.length };
}
