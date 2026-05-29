import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { AccessContext } from "@/lib/auth/staff-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PosIntegrationContext } from "@/lib/outbox/types";

/** Mutating fiscal actions require standalone register mode (ADR-011 L5). */
const STANDALONE_FISCAL_PERMISSIONS: ReadonlySet<PermissionKey> = new Set([
  "fiscal.shift.close",
  "fiscal.storno.execute",
  "fiscal.export.accounting",
  "fiscal.export.audit",
]);

async function loadPosIntegration(
  locationId: string
): Promise<PosIntegrationContext | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pos_integrations")
    .select("id, provider, status")
    .eq("location_id", locationId)
    .eq("status", "connected")
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    provider: string;
    status: PosIntegrationContext["status"];
  };

  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
  };
}

export async function loadComplianceContextForLocation(
  locationId: string
): Promise<AccessContext> {
  const posIntegration = await loadPosIntegration(locationId);
  return { locationId, posIntegration };
}

/**
 * Compliance guards applied after permission + location checks (ADR-024 §8).
 */
export function runComplianceGuards(
  permission: PermissionKey,
  ctx?: AccessContext
): boolean {
  if (STANDALONE_FISCAL_PERMISSIONS.has(permission)) {
    const behavior = resolveFiscalBehavior(ctx?.posIntegration ?? null);
    if (behavior !== "standalone") {
      return false;
    }
  }

  return true;
}
