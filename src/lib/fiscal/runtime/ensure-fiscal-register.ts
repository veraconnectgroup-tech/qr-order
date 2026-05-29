import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionFiskalyRegisterForLocation } from "@/lib/fiscal/provision-fiskaly-register";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";

export type FiscalRegisterRow = {
  id: string;
  org_id: string;
  location_id: string;
  kassen_id: string;
  fiskaly_tss_id: string;
  fiskaly_client_id: string;
};

function sanitizeKassenId(locationId: string, locationName: string): string {
  const fromName = locationName
    .replace(/[^A-Za-z0-9 '+(),\-./:=?]/g, "")
    .slice(0, 40);
  if (fromName) return fromName;
  return `loc-${locationId.slice(0, 8)}`;
}

/** Lazy register row per location — FC-6 per-location Fiskaly client when configured. */
export async function ensureFiscalRegister(
  admin: SupabaseClient,
  locationId: string,
  orgId: string
): Promise<FiscalRegisterRow | null> {
  const { data: existing, error: existingError } = await admin
    .from("fiscal_registers")
    .select(
      "id, org_id, location_id, kassen_id, fiskaly_tss_id, fiskaly_client_id"
    )
    .eq("location_id", locationId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`fiscal_registers lookup failed: ${existingError.message}`);
  }

  if (existing) {
    return existing as FiscalRegisterRow;
  }

  if (isFiskalyConfigured()) {
    const provisioned = await provisionFiskalyRegisterForLocation(
      orgId,
      locationId
    );
    if (provisioned) {
      return {
        id: provisioned.registerId,
        org_id: orgId,
        location_id: locationId,
        kassen_id: provisioned.kassenId,
        fiskaly_tss_id: provisioned.tssId,
        fiskaly_client_id: provisioned.clientId,
      };
    }
  }

  const [{ data: org, error: orgError }, { data: location, error: locError }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("fiskaly_tss_id, fiskaly_client_id")
        .eq("id", orgId)
        .single(),
      admin
        .from("locations")
        .select("name")
        .eq("id", locationId)
        .single(),
    ]);

  if (orgError || !org) {
    throw new Error("Organization not found for fiscal register.");
  }

  if (locError || !location) {
    throw new Error("Location not found for fiscal register.");
  }

  const orgRow = org as {
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  };

  if (!orgRow.fiskaly_tss_id || !orgRow.fiskaly_client_id) {
    return null;
  }

  const locationName = (location as { name: string }).name;
  const kassenId = sanitizeKassenId(locationId, locationName);

  const { data: inserted, error: insertError } = await admin
    .from("fiscal_registers")
    .insert({
      org_id: orgId,
      location_id: locationId,
      kassen_id: kassenId,
      fiskaly_tss_id: orgRow.fiskaly_tss_id,
      fiskaly_client_id: orgRow.fiskaly_client_id,
      status: "active",
    })
    .select(
      "id, org_id, location_id, kassen_id, fiskaly_tss_id, fiskaly_client_id"
    )
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await admin
        .from("fiscal_registers")
        .select(
          "id, org_id, location_id, kassen_id, fiskaly_tss_id, fiskaly_client_id"
        )
        .eq("location_id", locationId)
        .maybeSingle();
      return (raced as FiscalRegisterRow | null) ?? null;
    }
    throw new Error(`fiscal_registers insert failed: ${insertError.message}`);
  }

  return inserted as FiscalRegisterRow;
}
