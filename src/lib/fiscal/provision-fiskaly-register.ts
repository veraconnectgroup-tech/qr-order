import { createAdminClient } from "@/lib/supabase/admin";
import { getFiskalyClient, isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { ensureKassenmeldungForRegister } from "@/lib/fiscal/kassenmeldung";
import { provisionFiskalyTss } from "@/lib/fiscal/provision-tss";

function sanitizeClientSerialNumber(slug: string, locationId: string): string {
  const cleaned = slug
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9 '+(),\-./:=?]/g, "")
    .slice(0, 60);

  if (cleaned) return cleaned;
  return `loc-${locationId.slice(0, 8)}`;
}

function sanitizeKassenId(locationName: string, locationId: string): string {
  const fromName = locationName
    .replace(/[^A-Za-z0-9 '+(),\-./:=?]/g, "")
    .slice(0, 40);
  if (fromName) return fromName;
  return `loc-${locationId.slice(0, 8)}`;
}

export type ProvisionRegisterResult = {
  registerId: string;
  tssId: string;
  clientId: string;
  kassenId: string;
  skipped: boolean;
};

/** FC-6: one Fiskaly client per location on shared org TSS. */
export async function provisionFiskalyRegisterForLocation(
  organizationId: string,
  locationId: string
): Promise<ProvisionRegisterResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const admin = createAdminClient();

  const { data: location, error: locError } = await admin
    .from("locations")
    .select("id, org_id, name")
    .eq("id", locationId)
    .eq("org_id", organizationId)
    .single();

  if (locError || !location) {
    throw new Error("Location not found.");
  }

  const locRow = location as {
    id: string;
    org_id: string;
    name: string;
  };

  const { data: existing } = await admin
    .from("fiscal_registers")
    .select("id, fiskaly_tss_id, fiskaly_client_id, kassen_id")
    .eq("location_id", locationId)
    .maybeSingle();

  if (existing) {
    const row = existing as {
      id: string;
      fiskaly_tss_id: string;
      fiskaly_client_id: string;
      kassen_id: string;
    };
    return {
      registerId: row.id,
      tssId: row.fiskaly_tss_id,
      clientId: row.fiskaly_client_id,
      kassenId: row.kassen_id,
      skipped: true,
    };
  }

  const orgProvision = await provisionFiskalyTss(organizationId);
  if (!orgProvision) {
    throw new Error("Fiskaly org TSS could not be provisioned.");
  }

  const fiskaly = getFiskalyClient();
  const clientId = crypto.randomUUID();
  const serialNumber = sanitizeClientSerialNumber(locRow.name, locationId);
  const kassenId = sanitizeKassenId(locRow.name, locationId);

  await fiskaly.createClient(orgProvision.tssId, clientId, serialNumber, {
    organization_id: organizationId,
    location_id: locationId,
  });

  const { data: inserted, error: insertError } = await admin
    .from("fiscal_registers")
    .insert({
      org_id: organizationId,
      location_id: locationId,
      kassen_id: kassenId,
      fiskaly_tss_id: orgProvision.tssId,
      fiskaly_client_id: clientId,
      status: "active",
    } as never)
    .select("id, fiskaly_tss_id, fiskaly_client_id, kassen_id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await admin
        .from("fiscal_registers")
        .select("id, fiskaly_tss_id, fiskaly_client_id, kassen_id")
        .eq("location_id", locationId)
        .maybeSingle();
      if (raced) {
        const row = raced as {
          id: string;
          fiskaly_tss_id: string;
          fiskaly_client_id: string;
          kassen_id: string;
        };
        return {
          registerId: row.id,
          tssId: row.fiskaly_tss_id,
          clientId: row.fiskaly_client_id,
          kassenId: row.kassen_id,
          skipped: true,
        };
      }
    }
    throw new Error(`Could not save fiscal register: ${insertError.message}`);
  }

  const row = inserted as {
    id: string;
    fiskaly_tss_id: string;
    fiskaly_client_id: string;
    kassen_id: string;
  };

  await ensureKassenmeldungForRegister(admin, {
    orgId: organizationId,
    locationId,
    registerId: row.id,
    kassenId: row.kassen_id,
    inbetriebnahmeAt: new Date().toISOString(),
  });

  return {
    registerId: row.id,
    tssId: row.fiskaly_tss_id,
    clientId: row.fiskaly_client_id,
    kassenId: row.kassen_id,
    skipped: false,
  };
}
