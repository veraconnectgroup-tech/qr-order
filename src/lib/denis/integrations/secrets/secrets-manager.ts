/**
 * ADR-052 §I — SecretsManager. Every real value is stored/read through
 * Postgres pgcrypto (store_integration_credential/read_integration_credential,
 * SECURITY DEFINER, service_role-only — see 00170 migration), with the
 * encryption key held only in env.ts, never in the database. Nothing in
 * this module returns a raw value to a caller unless resolveCredentialValue
 * is called explicitly from an execution boundary (sandbox-runner.ts today,
 * a future live-adapter caller) — LLM-generated adapter code and the
 * agentic tool loop only ever see a credentialRef (the row id), never the
 * decrypted value directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database";

export type IntegrationCredentialEnvironment =
  Database["public"]["Tables"]["integration_credentials"]["Row"]["environment"];
export type IntegrationCredentialType =
  Database["public"]["Tables"]["integration_credentials"]["Row"]["credential_type"];

export async function storeCredential(
  admin: SupabaseClient,
  input: {
    providerId: string;
    locationId: string;
    environment: IntegrationCredentialEnvironment;
    credentialType: IntegrationCredentialType;
    value: string;
    createdByStaffId: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const value = input.value.trim();
  if (!value) return { ok: false, error: "empty_value" };

  const { data, error } = await admin.rpc("store_integration_credential", {
    p_provider_id: input.providerId,
    p_location_id: input.locationId,
    p_environment: input.environment,
    p_credential_type: input.credentialType,
    p_value: value,
    p_encryption_key: env.integrationCredentialsEncryptionKey,
    p_created_by_staff_id: input.createdByStaffId,
  });

  if (error || !data) {
    logger.warn("storeCredential failed", {
      providerId: input.providerId,
      locationId: input.locationId,
      environment: input.environment,
      credentialType: input.credentialType,
      error: error?.message,
    });
    return { ok: false, error: "store_failed" };
  }

  return { ok: true, id: data as string };
}

/**
 * The ONLY function in this codebase that returns a decrypted credential
 * value. Callers must be an execution boundary, never code that hands the
 * result to an LLM prompt or logs it — sandbox-runner.ts's own docstring
 * on why it never touches 'production' rows applies equally here: this
 * function itself does not enforce that boundary, the CALLER must only
 * ever pass a sandbox-scoped credentialRef from a sandbox execution path.
 */
export async function resolveCredentialValue(
  admin: SupabaseClient,
  credentialRef: string
): Promise<string | null> {
  const { data, error } = await admin.rpc("read_integration_credential", {
    p_id: credentialRef,
    p_encryption_key: env.integrationCredentialsEncryptionKey,
  });

  if (error) {
    logger.warn("resolveCredentialValue failed", {
      credentialRef,
      error: error.message,
    });
    return null;
  }

  return (data as string | null) ?? null;
}

/**
 * Same decrypt as resolveCredentialValue, but enforces environment='sandbox'
 * at the query level FIRST — a production credentialRef fails closed
 * (returns null) here even if a caller passes one by mistake, instead of
 * relying purely on caller discipline. sandbox-runner.ts should call this,
 * never resolveCredentialValue directly.
 */
export async function resolveSandboxCredentialValue(
  admin: SupabaseClient,
  credentialRef: string
): Promise<string | null> {
  const { data: row } = await admin
    .from("integration_credentials")
    .select("id, environment")
    .eq("id", credentialRef)
    .eq("environment", "sandbox")
    .maybeSingle();

  if (!row) return null;
  return resolveCredentialValue(admin, credentialRef);
}

export type CredentialMetadata = {
  id: string;
  providerId: string;
  locationId: string;
  environment: IntegrationCredentialEnvironment;
  credentialType: IntegrationCredentialType;
  createdAt: string;
};

/** Metadata only — never the value. For admin UI listing / audit, not execution. */
export async function listCredentialsForProvider(
  admin: SupabaseClient,
  input: { providerId: string; locationId: string }
): Promise<CredentialMetadata[]> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select("id, provider_id, location_id, environment, credential_type, created_at")
    .eq("provider_id", input.providerId)
    .eq("location_id", input.locationId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("listCredentialsForProvider failed", {
      providerId: input.providerId,
      locationId: input.locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      provider_id: string;
      location_id: string;
      environment: IntegrationCredentialEnvironment;
      credential_type: IntegrationCredentialType;
      created_at: string;
    };
    return {
      id: r.id,
      providerId: r.provider_id,
      locationId: r.location_id,
      environment: r.environment,
      credentialType: r.credential_type,
      createdAt: r.created_at,
    };
  });
}

export async function deleteCredential(
  admin: SupabaseClient,
  input: { id: string; locationId: string }
): Promise<boolean> {
  const { error } = await admin
    .from("integration_credentials")
    .delete()
    .eq("id", input.id)
    .eq("location_id", input.locationId);

  if (error) {
    logger.warn("deleteCredential failed", { id: input.id, error: error.message });
    return false;
  }
  return true;
}
