"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { generateOperatorApiKey } from "@/lib/operator/keys";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createOperatorApiKeyAction(formData: FormData) {
  const staff = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const { rawKey, prefix, hash } = generateOperatorApiKey();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("operator_api_keys")
    .insert({
      org_id: staff.org_id,
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: ["operator:read"],
    } as never)
    .select("id, name, key_prefix, scopes, created_at")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create operator API key." };
  }

  revalidatePath("/admin/settings");
  return { data: { ...data, rawKey } };
}

export async function revokeOperatorApiKeyAction(keyId: string) {
  const staff = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("operator_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", staff.org_id)
    .is("revoked_at", null);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}
