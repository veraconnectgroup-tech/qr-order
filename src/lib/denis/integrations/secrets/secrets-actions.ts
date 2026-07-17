"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  storeCredential,
  listCredentialsForProvider,
  deleteCredential,
  type CredentialMetadata,
} from "@/lib/denis/integrations/secrets/secrets-manager";

const environmentSchema = z.enum(["sandbox", "production"]);
const credentialTypeSchema = z.enum([
  "api_key",
  "basic_auth",
  "oauth2_client_credentials",
  "bearer_token",
  "hmac_secret",
  "webhook_secret",
  "mtls_cert",
]);

const storeSchema = z.object({
  providerId: z.string().trim().min(1).max(100),
  environment: environmentSchema,
  credentialType: credentialTypeSchema,
  value: z.string().trim().min(1).max(4000),
});

/**
 * Admin-only entry point for ADR-052 §I's SecretsManager — the value
 * itself never touches a Server Component prop or a client re-render
 * beyond this one submit; only metadata (listCredentials) is ever read
 * back. requireAdmin() + location scoping here is the auth boundary
 * secrets-manager.ts's own docstring assumes callers provide.
 */
export async function storeIntegrationCredential(
  input: z.infer<typeof storeSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "no_location" };
  }

  const admin = createAdminClient();
  const result = await storeCredential(admin, {
    providerId: parsed.data.providerId,
    locationId,
    environment: parsed.data.environment,
    credentialType: parsed.data.credentialType,
    value: parsed.data.value,
    createdByStaffId: staff.id,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await auditLog({
    orgId: staff.org_id,
    userId: staff.id,
    action: "create",
    entityType: "integration_credential",
    entityId: result.id,
    newValue: {
      providerId: parsed.data.providerId,
      locationId,
      environment: parsed.data.environment,
      credentialType: parsed.data.credentialType,
      // Never the value itself.
    },
  });

  revalidatePath("/admin/integration-credentials");
  return { ok: true };
}

export async function listIntegrationCredentials(
  providerId: string
): Promise<CredentialMetadata[]> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return [];

  const admin = createAdminClient();
  return listCredentialsForProvider(admin, {
    providerId: providerId.trim(),
    locationId,
  });
}

export async function deleteIntegrationCredential(
  credentialId: string
): Promise<boolean> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return false;

  const admin = createAdminClient();
  const ok = await deleteCredential(admin, { id: credentialId, locationId });

  if (ok) {
    await auditLog({
      orgId: staff.org_id,
      userId: staff.id,
      action: "delete",
      entityType: "integration_credential",
      entityId: credentialId,
    });
    revalidatePath("/admin/integration-credentials");
  }

  return ok;
}
