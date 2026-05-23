"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/api/v1/auth";
import { API_SCOPES, type ApiScope } from "@/lib/api/v1/scopes";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks/events";
import { sendTestWebhook } from "@/lib/webhooks/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

function parseScopes(raw: FormDataEntryValue | null): ApiScope[] {
  if (typeof raw !== "string" || !raw.trim()) return ["orders:read"];
  const scopes = raw.split(",").map((s) => s.trim()) as ApiScope[];
  return scopes.filter((s) => (API_SCOPES as readonly string[]).includes(s));
}

function parseEvents(raw: FormDataEntryValue | null): WebhookEvent[] {
  if (typeof raw !== "string" || !raw.trim()) return ["order.created"];
  const events = raw.split(",").map((s) => s.trim()) as WebhookEvent[];
  return events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
}

export async function createApiKeyAction(formData: FormData) {
  const staff = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const scopes = parseScopes(formData.get("scopes"));
  const { rawKey, prefix, hash } = generateApiKey();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("api_keys")
    .insert({
      org_id: staff.org_id,
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes,
    } as never)
    .select("id, name, key_prefix, scopes, created_at")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create key." };

  revalidatePath("/admin/settings");
  return { data: { ...data, rawKey } };
}

export async function revokeApiKeyAction(keyId: string) {
  const staff = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", staff.org_id)
    .is("revoked_at", null);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function createWebhookAction(formData: FormData) {
  const staff = await requireAdmin();
  const url = String(formData.get("url") ?? "").trim();
  if (!url.startsWith("https://")) {
    return { error: "Webhook URL must use HTTPS." };
  }

  const events = parseEvents(formData.get("events"));
  const secret = randomBytes(32).toString("hex");
  const admin = createAdminClient();

  const { error } = await admin.from("webhook_configs").insert({
    org_id: staff.org_id,
    url,
    secret,
    events,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleWebhookAction(webhookId: string, active: boolean) {
  const staff = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("webhook_configs")
    .update({
      is_active: active,
      ...(active ? { failure_count: 0 } : {}),
    })
    .eq("id", webhookId)
    .eq("org_id", staff.org_id);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteWebhookAction(webhookId: string) {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("webhook_configs")
    .delete()
    .eq("id", webhookId)
    .eq("org_id", staff.org_id);

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function testWebhookAction(webhookId: string) {
  const staff = await requireAdmin();
  return sendTestWebhook(webhookId, staff.org_id);
}
