import { apiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashOperatorApiKey,
  isOperatorApiKeyFormat,
} from "@/lib/operator/keys";
import type { OperatorScope } from "@/lib/operator/scopes";
import { hasOperatorScope } from "@/lib/operator/scopes";

export type OperatorApiContext = {
  keyId: string;
  orgId: string;
  scopes: string[];
};

function parseBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization")?.trim();
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function authenticateOperatorApiKey(
  req: Request
): Promise<OperatorApiContext | Response> {
  const rawKey = parseBearerToken(req);
  if (!rawKey) {
    return apiError("Missing Authorization Bearer token.", 401);
  }

  if (!isOperatorApiKeyFormat(rawKey)) {
    return apiError("Invalid operator API key.", 401);
  }

  const admin = createAdminClient();
  const keyHash = hashOperatorApiKey(rawKey);

  const { data: row } = await admin
    .from("operator_api_keys")
    .select("id, org_id, scopes, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!row) {
    return apiError("Invalid operator API key.", 401);
  }

  const key = row as {
    id: string;
    org_id: string;
    scopes: string[];
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (key.revoked_at) {
    return apiError("Operator API key revoked.", 401);
  }

  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return apiError("Operator API key expired.", 401);
  }

  const orgHeader = req.headers.get("x-denis-org-id")?.trim();
  if (orgHeader && orgHeader !== key.org_id) {
    return apiError("Organization mismatch.", 403);
  }

  void admin
    .from("operator_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    keyId: key.id,
    orgId: key.org_id,
    scopes: key.scopes ?? [],
  };
}

export function requireOperatorScope(
  ctx: OperatorApiContext,
  scope: OperatorScope
): Response | null {
  if (!hasOperatorScope(ctx.scopes, scope)) {
    return apiError(`Missing scope: ${scope}`, 403);
  }
  return null;
}
