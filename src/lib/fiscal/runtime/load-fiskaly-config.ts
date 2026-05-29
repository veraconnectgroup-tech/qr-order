import type { SupabaseClient } from "@supabase/supabase-js";

export type FiskalySigningConfig = {
  fiskaly_tss_id: string;
  fiskaly_client_id: string;
  registerId?: string;
};

/** Prefer per-location fiscal_registers; fall back to org-scoped IDs (FC-6). */
export async function loadFiskalyConfigForSigning(
  admin: SupabaseClient,
  organizationId: string,
  locationId?: string
): Promise<FiskalySigningConfig | null> {
  if (locationId) {
    const { data: register } = await admin
      .from("fiscal_registers")
      .select("id, fiskaly_tss_id, fiskaly_client_id, status")
      .eq("location_id", locationId)
      .eq("status", "active")
      .maybeSingle();

    if (register) {
      const row = register as {
        id: string;
        fiskaly_tss_id: string;
        fiskaly_client_id: string;
      };
      if (row.fiskaly_tss_id && row.fiskaly_client_id) {
        return {
          fiskaly_tss_id: row.fiskaly_tss_id,
          fiskaly_client_id: row.fiskaly_client_id,
          registerId: row.id,
        };
      }
    }
  }

  const { data, error } = await admin
    .from("organizations")
    .select("fiskaly_tss_id, fiskaly_client_id")
    .eq("id", organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  const org = data as {
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  };

  if (!org.fiskaly_tss_id || !org.fiskaly_client_id) {
    return null;
  }

  return {
    fiskaly_tss_id: org.fiskaly_tss_id,
    fiskaly_client_id: org.fiskaly_client_id,
  };
}
