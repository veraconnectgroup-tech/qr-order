"use server";

import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadDenisAuditTrailSnapshot } from "@/lib/admin/load-denis-audit-trail";
import { formatAuditTrailCsv } from "@/lib/denis/compliance/audit-trail";
import { auditLog } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";

export async function exportDenisAuditTrailCsv(input?: {
  periodDays?: number;
}): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const admin = createAdminClient();
  const snapshot = await loadDenisAuditTrailSnapshot(admin, {
    locationId,
    periodDays: input?.periodDays ?? 30,
    limit: 2000,
  });

  const csv = formatAuditTrailCsv(snapshot.recentEntries);
  const filename = `denis-audit-trail-${locationId.slice(0, 8)}-${Date.now()}.csv`;

  const { data: locationRow } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  const orgId = (locationRow as { org_id?: string } | null)?.org_id;
  if (orgId) {
    await auditLog({
      orgId,
      userId: staff.id,
      action: "export",
      entityType: "denis_audit_trail",
      entityId: locationId,
      newValue: { periodDays: input?.periodDays ?? 30, rowCount: snapshot.turnCount },
    });
  }

  return { ok: true, csv, filename };
}
