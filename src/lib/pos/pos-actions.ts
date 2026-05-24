"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type PosProvider =
  | "deliverect"
  | "orderbird"
  | "lightspeed"
  | "ready2order"
  | "custom";

export type PosIntegrationRow = {
  id: string;
  location_id: string;
  provider: PosProvider;
  status: "disconnected" | "connected" | "error";
  config: Json;
  external_location_id: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const providerSchema = z.enum([
  "deliverect",
  "orderbird",
  "lightspeed",
  "ready2order",
  "custom",
]);

const connectSchema = z.object({
  locationId: z.string().uuid(),
  provider: providerSchema,
  externalLocationId: z.string().max(256).optional(),
  config: z.record(z.string(), z.unknown()),
});

async function assertLocationAccess(locationId: string, orgId: string) {
  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("org_id", orgId)
    .single();

  if (!location) {
    throw new Error("Standort nicht gefunden.");
  }
}

async function assertIntegrationAccess(integrationId: string, orgId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("pos_integrations")
    .select("id, location_id")
    .eq("id", integrationId)
    .single();

  if (!row) {
    throw new Error("Integration nicht gefunden.");
  }

  const integration = row as { id: string; location_id: string };
  await assertLocationAccess(integration.location_id, orgId);
  return integration;
}

export async function getPosIntegrations(
  locationId: string
): Promise<PosIntegrationRow[]> {
  const staff = await requireAdmin();
  await assertLocationAccess(locationId, staff.org_id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pos_integrations")
    .select("*")
    .eq("location_id", locationId)
    .order("provider");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PosIntegrationRow[];
}

export async function connectPosIntegration(
  locationId: string,
  provider: PosProvider,
  externalLocationId: string | null,
  config: Record<string, unknown>
) {
  const staff = await requireAdmin();
  const parsed = connectSchema.safeParse({
    locationId,
    provider,
    externalLocationId: externalLocationId ?? undefined,
    config,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  await assertLocationAccess(parsed.data.locationId, staff.org_id);

  const existingSecret =
    typeof parsed.data.config.webhook_secret === "string"
      ? parsed.data.config.webhook_secret.trim()
      : "";
  const configWithDefaults = {
    ...parsed.data.config,
    webhook_secret: existingSecret || randomBytes(32).toString("hex"),
    inbound_enabled: parsed.data.config.inbound_enabled !== false,
  };

  const admin = createAdminClient();
  const { error } = await admin.from("pos_integrations").upsert(
    {
      location_id: parsed.data.locationId,
      provider: parsed.data.provider,
      status: "connected",
      config: configWithDefaults as Json,
      external_location_id: parsed.data.externalLocationId?.trim() || null,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id,provider" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return {
    success: true as const,
    webhookSecret: configWithDefaults.webhook_secret as string,
  };
}

export async function disconnectPosIntegration(integrationId: string) {
  const staff = await requireAdmin();
  await assertIntegrationAccess(integrationId, staff.org_id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("pos_integrations")
    .update({
      status: "disconnected",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return { success: true as const };
}

export async function deletePosIntegration(integrationId: string) {
  const staff = await requireAdmin();
  await assertIntegrationAccess(integrationId, staff.org_id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("pos_integrations")
    .delete()
    .eq("id", integrationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return { success: true as const };
}

export type PosTableMappingRow = {
  id: string;
  location_id: string;
  provider: PosProvider;
  external_table_key: string;
  table_id: string;
  table_name: string;
};

export async function getPosTableMappings(
  integrationId: string
): Promise<PosTableMappingRow[]> {
  const staff = await requireAdmin();
  const integration = await assertIntegrationAccess(integrationId, staff.org_id);
  const admin = createAdminClient();

  const { data: integrationRow } = await admin
    .from("pos_integrations")
    .select("provider")
    .eq("id", integrationId)
    .single();

  const provider = (integrationRow as { provider: PosProvider } | null)
    ?.provider;
  if (!provider) return [];

  const { data, error } = await admin
    .from("pos_table_mappings")
    .select("id, location_id, provider, external_table_key, table_id")
    .eq("location_id", integration.location_id)
    .eq("provider", provider)
    .order("external_table_key");

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    location_id: string;
    provider: PosProvider;
    external_table_key: string;
    table_id: string;
  }>;

  if (!rows.length) return [];

  const tableIds = rows.map((row) => row.table_id);
  const { data: tables } = await admin
    .from("tables")
    .select("id, name")
    .in("id", tableIds);

  const nameById = new Map(
    ((tables ?? []) as Array<{ id: string; name: string }>).map((table) => [
      table.id,
      table.name,
    ])
  );

  return rows.map((row) => ({
    ...row,
    table_name: nameById.get(row.table_id) ?? "—",
  }));
}

export async function upsertPosTableMapping(
  integrationId: string,
  externalTableKey: string,
  tableId: string
) {
  const staff = await requireAdmin();
  const integration = await assertIntegrationAccess(integrationId, staff.org_id);

  const key = externalTableKey.trim();
  if (!key) {
    return { error: "POS table name is required." };
  }

  const admin = createAdminClient();

  const { data: integrationRow } = await admin
    .from("pos_integrations")
    .select("provider")
    .eq("id", integrationId)
    .single();

  const provider = (integrationRow as { provider: PosProvider } | null)?.provider;
  if (!provider) {
    return { error: "Integration not found." };
  }

  const { data: table } = await admin
    .from("tables")
    .select("id")
    .eq("id", tableId)
    .eq("location_id", integration.location_id)
    .maybeSingle();

  if (!table) {
    return { error: "Table not found for this location." };
  }

  const { error } = await admin.from("pos_table_mappings").upsert(
    {
      location_id: integration.location_id,
      provider,
      external_table_key: key,
      table_id: tableId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id,provider,external_table_key" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return { success: true as const };
}

export async function deletePosTableMapping(mappingId: string) {
  const staff = await requireAdmin();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pos_table_mappings")
    .select("id, location_id")
    .eq("id", mappingId)
    .maybeSingle();

  if (!row) {
    return { error: "Mapping not found." };
  }

  await assertLocationAccess(
    (row as { location_id: string }).location_id,
    staff.org_id
  );

  const { error } = await admin
    .from("pos_table_mappings")
    .delete()
    .eq("id", mappingId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return { success: true as const };
}

export async function getPosTableMappingsForLocation(
  locationId: string,
  provider?: PosProvider
): Promise<PosTableMappingRow[]> {
  const staff = await requireAdmin();
  await assertLocationAccess(locationId, staff.org_id);

  const admin = createAdminClient();
  let query = admin
    .from("pos_table_mappings")
    .select("id, location_id, provider, external_table_key, table_id")
    .eq("location_id", locationId)
    .order("provider")
    .order("external_table_key");

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    location_id: string;
    provider: PosProvider;
    external_table_key: string;
    table_id: string;
  }>;

  if (!rows.length) return [];

  const tableIds = [...new Set(rows.map((row) => row.table_id))];
  const { data: tables } = await admin
    .from("tables")
    .select("id, name")
    .in("id", tableIds);

  const nameById = new Map(
    ((tables ?? []) as Array<{ id: string; name: string }>).map((table) => [
      table.id,
      table.name,
    ])
  );

  return rows.map((row) => ({
    ...row,
    table_name: nameById.get(row.table_id) ?? "—",
  }));
}

export async function bulkImportPosTableMappings(
  integrationId: string,
  rows: Array<{ externalTableKey: string; tableId: string }>
) {
  const staff = await requireAdmin();
  const integration = await assertIntegrationAccess(integrationId, staff.org_id);

  if (!rows.length) {
    return { error: "No mappings to import." };
  }

  const normalized = rows.map((row) => ({
    externalTableKey: row.externalTableKey.trim(),
    tableId: row.tableId.trim(),
  }));

  for (const row of normalized) {
    if (!row.externalTableKey) {
      return { error: "Every row needs a POS table name." };
    }
    if (!z.string().uuid().safeParse(row.tableId).success) {
      return { error: `Invalid Vera table for "${row.externalTableKey}".` };
    }
  }

  const seenKeys = new Set<string>();
  for (const row of normalized) {
    const key = row.externalTableKey.toLowerCase();
    if (seenKeys.has(key)) {
      return {
        error: `Duplicate POS table name in import: "${row.externalTableKey}".`,
      };
    }
    seenKeys.add(key);
  }

  const admin = createAdminClient();

  const { data: integrationRow } = await admin
    .from("pos_integrations")
    .select("provider")
    .eq("id", integrationId)
    .single();

  const provider = (integrationRow as { provider: PosProvider } | null)?.provider;
  if (!provider) {
    return { error: "Integration not found." };
  }

  const tableIds = [...new Set(normalized.map((row) => row.tableId))];
  const { data: tables } = await admin
    .from("tables")
    .select("id")
    .eq("location_id", integration.location_id)
    .in("id", tableIds);

  const validTableIds = new Set(
    ((tables ?? []) as Array<{ id: string }>).map((table) => table.id)
  );

  for (const row of normalized) {
    if (!validTableIds.has(row.tableId)) {
      return {
        error: `Vera table not found for POS name "${row.externalTableKey}".`,
      };
    }
  }

  const now = new Date().toISOString();
  const payload = normalized.map((row) => ({
    location_id: integration.location_id,
    provider,
    external_table_key: row.externalTableKey,
    table_id: row.tableId,
    updated_at: now,
  }));

  const { error } = await admin
    .from("pos_table_mappings")
    .upsert(payload, {
      onConflict: "location_id,provider,external_table_key",
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  revalidatePath("/admin/table-mappings");
  return { success: true as const, imported: normalized.length };
}

export async function getLocationTablesForPosMapping(locationId: string) {
  const staff = await requireAdmin();
  await assertLocationAccess(locationId, staff.org_id);

  const admin = createAdminClient();
  const { data } = await admin
    .from("tables")
    .select("id, name")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  return ((data ?? []) as Array<{ id: string; name: string }>).map((table) => ({
    id: table.id,
    name: table.name,
  }));
}
