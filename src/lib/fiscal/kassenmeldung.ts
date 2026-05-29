import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeCsvField } from "@/lib/security/escape";

export type FiscalRegistrationRow = {
  id: string;
  org_id: string;
  location_id: string;
  register_id: string;
  kassen_id: string;
  tss_serial: string | null;
  inbetriebnahme_at: string;
  ausserbetriebnahme_at: string | null;
  elster_kennung: string | null;
  status: "active" | "decommissioned";
  created_at: string;
  location_name?: string;
  register_kassen_id?: string;
};

export type CreateKassenmeldungInput = {
  orgId: string;
  locationId: string;
  registerId: string;
  kassenId: string;
  inbetriebnahmeAt: string;
  tssSerial?: string | null;
  elsterKennung?: string | null;
};

export async function listFiscalRegistrations(
  admin: SupabaseClient,
  orgId: string,
  locationId?: string
): Promise<FiscalRegistrationRow[]> {
  let query = admin
    .from("fiscal_registrations")
    .select(
      `
      id, org_id, location_id, register_id, kassen_id, tss_serial,
      inbetriebnahme_at, ausserbetriebnahme_at, elster_kennung, status, created_at,
      locations ( name ),
      fiscal_registers ( kassen_id )
    `
    )
    .eq("org_id", orgId)
    .order("inbetriebnahme_at", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kassenmeldungen could not be loaded: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const locations = r.locations as { name: string } | { name: string }[] | null;
    const registers = r.fiscal_registers as
      | { kassen_id: string }
      | { kassen_id: string }[]
      | null;

    const locationName = Array.isArray(locations)
      ? locations[0]?.name
      : locations?.name;
    const registerKassenId = Array.isArray(registers)
      ? registers[0]?.kassen_id
      : registers?.kassen_id;

    return {
      id: r.id as string,
      org_id: r.org_id as string,
      location_id: r.location_id as string,
      register_id: r.register_id as string,
      kassen_id: r.kassen_id as string,
      tss_serial: (r.tss_serial as string | null) ?? null,
      inbetriebnahme_at: r.inbetriebnahme_at as string,
      ausserbetriebnahme_at: (r.ausserbetriebnahme_at as string | null) ?? null,
      elster_kennung: (r.elster_kennung as string | null) ?? null,
      status: r.status as "active" | "decommissioned",
      created_at: r.created_at as string,
      location_name: locationName,
      register_kassen_id: registerKassenId,
    };
  });
}

export async function createFiscalRegistration(
  admin: SupabaseClient,
  input: CreateKassenmeldungInput
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("fiscal_registrations")
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      register_id: input.registerId,
      kassen_id: input.kassenId.trim(),
      tss_serial: input.tssSerial?.trim() || null,
      inbetriebnahme_at: input.inbetriebnahmeAt,
      elster_kennung: input.elsterKennung?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Kassenmeldung could not be saved: ${error?.message ?? "unknown"}`
    );
  }

  return { id: (data as { id: string }).id };
}

export async function decommissionFiscalRegistration(
  admin: SupabaseClient,
  registrationId: string,
  orgId: string,
  ausserbetriebnahmeAt: string
): Promise<void> {
  const { error } = await admin
    .from("fiscal_registrations")
    .update({
      status: "decommissioned",
      ausserbetriebnahme_at: ausserbetriebnahmeAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Außerbetriebnahme failed: ${error.message}`);
  }
}

export function buildKassenmeldungExportCsv(
  rows: FiscalRegistrationRow[]
): string {
  const headers = [
    "Kassen_ID",
    "TSS_Seriennummer",
    "Inbetriebnahme",
    "Außerbetriebnahme",
    "ELSTER_Kennung",
    "Status",
    "Standort",
  ];

  const lines = rows.map((row) =>
    [
      row.kassen_id,
      row.tss_serial ?? "",
      row.inbetriebnahme_at,
      row.ausserbetriebnahme_at ?? "",
      row.elster_kennung ?? "",
      row.status,
      row.location_name ?? row.location_id,
    ]
      .map(escapeCsvField)
      .join(";")
  );

  return [headers.map(escapeCsvField).join(";"), ...lines].join("\n");
}
