import { redirect } from "next/navigation";
import { TagesabschlussPanel } from "@/components/admin/tagesabschluss-panel";
import { getEffectiveStaff, getStaffLocationId } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import { can } from "@/lib/auth/staff-access";
import {
  loadDailyClosingsForLocation,
  yesterdayBusinessDate,
} from "@/lib/fiscal/daily-closing";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function WaiterFiscalPage() {
  const staff = await getEffectiveStaff();
  const access = await getStaffAccess(staff);

  const mayClose = can(access, "fiscal.shift.close");
  const mayReport = can(access, "fiscal.report.daily");

  if (!mayClose && !mayReport) {
    redirect("/waiter");
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-4 text-sm text-dash-text-muted">
        No location found for this account.
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
    <div className="space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-dash-text">Fiscal</h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          {locationRow?.name ?? "Location"} — daily report &amp; shift close
        </p>
      </div>

      {mayClose || mayReport ? (
        <TagesabschlussPanel
          closings={closings}
          locationId={locationId}
          defaultBusinessDate={yesterdayBusinessDate(timezone)}
          currency={currency}
          allowManualClose={mayClose}
        />
      ) : null}
    </div>
  );
}
