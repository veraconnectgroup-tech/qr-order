import { OrgAnalyticsView } from "@/components/dashboard/org-analytics-view";
import { requireOwner } from "@/lib/auth/session";

export default async function OrgAnalyticsPage() {
  await requireOwner();
  return <OrgAnalyticsView />;
}
