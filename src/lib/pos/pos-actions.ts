"use server";

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

  const admin = createAdminClient();
  const { error } = await admin.from("pos_integrations").upsert(
    {
      location_id: parsed.data.locationId,
      provider: parsed.data.provider,
      status: "connected",
      config: parsed.data.config as Json,
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
  return { success: true as const };
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
  return { success: true as const };
}
