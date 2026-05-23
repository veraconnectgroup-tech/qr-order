import { createHash, randomBytes } from "crypto";
import { apiError } from "@/lib/api-response";
import { hasFeature } from "@/lib/platform/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiScope } from "@/lib/api/v1/scopes";
import { hasScope } from "@/lib/api/v1/scopes";

export type ApiKeyContext = {
  keyId: string;
  orgId: string;
  scopes: string[];
  locationIds: string[];
};

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  const rawKey = `qr_live_${token}`;
  const prefix = rawKey.slice(0, 12);
  return { rawKey, prefix, hash: hashApiKey(rawKey) };
}

export async function authenticateApiKey(
  req: Request
): Promise<ApiKeyContext | Response> {
  const rawKey = req.headers.get("x-api-key")?.trim();
  if (!rawKey) {
    return apiError("Missing X-API-Key header.", 401);
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);

  const { data: row } = await admin
    .from("api_keys")
    .select("id, org_id, scopes, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!row) {
    return apiError("Invalid API key.", 401);
  }

  const key = row as {
    id: string;
    org_id: string;
    scopes: string[];
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (key.revoked_at) {
    return apiError("API key revoked.", 401);
  }

  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return apiError("API key expired.", 401);
  }

  const { data: org } = await admin
    .from("organizations")
    .select("feature_flags")
    .eq("id", key.org_id)
    .maybeSingle();

  if (!hasFeature(org ?? {}, "api_access")) {
    return apiError("API access is not enabled for this organization.", 403);
  }

  const { data: locations } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", key.org_id)
    .eq("is_active", true);

  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    keyId: key.id,
    orgId: key.org_id,
    scopes: key.scopes ?? [],
    locationIds: ((locations ?? []) as Array<{ id: string }>).map((l) => l.id),
  };
}

export function requireScope(
  ctx: ApiKeyContext,
  scope: ApiScope
): Response | null {
  if (!hasScope(ctx.scopes, scope)) {
    return apiError(`Missing scope: ${scope}`, 403);
  }
  return null;
}
