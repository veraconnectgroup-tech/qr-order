import {
  getEffectiveStaff,
  getStaffLocationId,
} from "@/lib/auth/session";
import { fetchDashboardOverviewInitialData } from "@/lib/dashboard/overview-data";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

export default async function DashboardPage() {
  const staff = await getEffectiveStaff();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return null;
  }

  const initialData = await fetchDashboardOverviewInitialData(locationId);

  return <DashboardOverview initialData={initialData} />;
}
