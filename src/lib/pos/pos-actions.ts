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
  apiKey: z.string().min(1).max(512),
  externalLocationId: z.string().max(256).optional(),
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
    throw new Error("Location not found.");
  }
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

export async function connectPosIntegration(input: {
  locationId: string;
  provider: PosProvider;
  apiKey: string;
  externalLocationId?: string;
}) {
  const staff = await requireAdmin();
  const parsed = connectSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await assertLocationAccess(parsed.data.locationId, staff.org_id);

  const admin = createAdminClient();
  const config = {
    api_key: parsed.data.apiKey,
  } satisfies Record<string, string>;

  const { error } = await admin.from("pos_integrations").upsert(
    {
      location_id: parsed.data.locationId,
      provider: parsed.data.provider,
      status: "connected",
      config: config as unknown as Json,
      external_location_id: parsed.data.externalLocationId?.trim() || null,
      last_error: null,
      updated_at: new Date().toISOString(),
    } as never,
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
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("pos_integrations")
    .select("id, location_id")
    .eq("id", integrationId)
    .single();

  if (!row) {
    return { error: "Integration not found." };
  }

  const integration = row as { id: string; location_id: string };
  await assertLocationAccess(integration.location_id, staff.org_id);

  const { error } = await admin
    .from("pos_integrations")
    .update({
      status: "disconnected",
      last_error: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", integrationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/pos-integrations");
  return { success: true as const };
}
