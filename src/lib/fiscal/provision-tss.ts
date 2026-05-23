import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFiskalyAdminPin,
  getFiskalyClient,
  isFiskalyConfigured,
} from "@/lib/fiscal/fiskaly";

function sanitizeClientSerialNumber(slug: string): string {
  const cleaned = slug
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9 '+(),\-./:=?]/g, "")
    .slice(0, 70);

  return cleaned || "ordering-client";
}

function sanitizeTssDescription(name: string): string {
  return name.replace(/[^A-Za-z0-9 '()+,\-./:=?]/g, "").slice(0, 100);
}

export type ProvisionTssResult = {
  tssId: string;
  clientId: string;
  skipped: boolean;
};

export async function provisionFiskalyTss(
  organizationId: string
): Promise<ProvisionTssResult | null> {
  if (!isFiskalyConfigured()) {
    return null;
  }

  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, slug, fiskaly_tss_id, fiskaly_client_id")
    .eq("id", organizationId)
    .single();

  if (error || !org) {
    throw new Error("Organization not found.");
  }

  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
  };

  if (orgRow.fiskaly_tss_id && orgRow.fiskaly_client_id) {
    return {
      tssId: orgRow.fiskaly_tss_id,
      clientId: orgRow.fiskaly_client_id,
      skipped: true,
    };
  }

  const fiskaly = getFiskalyClient();
  const tssId = orgRow.fiskaly_tss_id ?? crypto.randomUUID();
  const clientId = orgRow.fiskaly_client_id ?? crypto.randomUUID();
  const adminPin = getFiskalyAdminPin();
  const description = sanitizeTssDescription(orgRow.name);
  const serialNumber = sanitizeClientSerialNumber(orgRow.slug);

  const created = await fiskaly.createTss(tssId, {
    organization_id: organizationId,
    organization_slug: orgRow.slug,
  });

  if (!created.admin_puk) {
    throw new Error("Fiskaly TSS created without admin PUK.");
  }

  await fiskaly.updateTss(
    tssId,
    { state: "UNINITIALIZED" },
    { timeoutMs: 60_000 }
  );

  await fiskaly.changeAdminPin(tssId, created.admin_puk, adminPin);
  await fiskaly.adminAuth(tssId, adminPin);

  await fiskaly.updateTss(tssId, {
    state: "INITIALIZED",
    description,
  });

  await fiskaly.createClient(tssId, clientId, serialNumber, {
    organization_id: organizationId,
  });

  const { error: updateError } = await admin
    .from("organizations")
    .update({
      fiskaly_tss_id: tssId,
      fiskaly_client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (updateError) {
    throw new Error(`Could not save Fiskaly IDs: ${updateError.message}`);
  }

  return { tssId, clientId, skipped: false };
}

export function scheduleFiskalyTssProvision(organizationId: string) {
  void provisionFiskalyTss(organizationId).catch((err) => {
    console.error(
      "[fiskaly] TSS provisioning failed for organization",
      organizationId,
      err
    );
  });
}
