import { redirect } from "next/navigation";
import { OrgHubView } from "@/components/dashboard/org-hub-view";
import { requireOwner } from "@/lib/auth/session";

export default async function OrgHubPage() {
  try {
    await requireOwner();
  } catch {
    redirect("/dashboard");
  }

  return <OrgHubView />;
}
