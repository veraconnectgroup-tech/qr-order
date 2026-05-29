import { redirect } from "next/navigation";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import { can } from "@/lib/auth/staff-access";
import { DsfinvkExportPanel } from "@/components/admin/dsfinvk-export-panel";
import { TagesabschlussPanel } from "@/components/admin/tagesabschluss-panel";
import {
  loadDailyClosingsForLocation,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminTagesabschlussPage() {
  const staff = await requireStaff();
  const access = await getStaffAccess(staff);

  const canClose = can(access, "fiscal.shift.close");
  const canReadShift = can(access, "fiscal.shift.read");
  const canExportAudit = can(access, "fiscal.export.audit");

  if (!canClose && !canReadShift && !canExportAudit) {
    redirect("/dashboard");
  }

  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Location not found.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [{ data: location }, { data: org }] = await Promise.all([
    admin
      .from("locations")
      .select("name, timezone")
      .eq("id", locationId)
      .single(),
    admin
      .from("organizations")
      .select("currency")
      .eq("id", staff.org_id)
      .single(),
  ]);

  const locationRow = location as { name: string; timezone: string } | null;
  const timezone = locationRow?.timezone ?? "Europe/Berlin";
  const currency =
    (org as { currency: string } | null)?.currency ?? "EUR";

  const closings = await loadDailyClosingsForLocation(
    admin,
    locationId,
    staff.org_id,
    30
  );

  return (
    <div className="space-y-6 p-6">
      {(canClose || canReadShift) && (
        <TagesabschlussPanel
          closings={closings}
          locationId={locationId}
          defaultBusinessDate={yesterdayBusinessDate(timezone)}
          currency={currency}
        />
      )}

      {canExportAudit && (
        <DsfinvkExportPanel
          locationId={locationId}
          locationName={locationRow?.name ?? "Standort"}
        />
      )}
    </div>
  );
}
