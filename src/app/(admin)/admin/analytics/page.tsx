import { DatevExportPanel } from "@/components/admin/datev-export-panel";
import { FeedbackRatingKpiCard } from "@/components/admin/feedback-rating-kpi-card";
import { TipsKpiCard } from "@/components/admin/tips-kpi-card";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAnalyticsPage() {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", staff.org_id)
    .single();
  const currency = (org as { currency: string } | null)?.currency ?? "EUR";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Export für Buchhaltung und monatlichen DATEV-Import.
        </p>
      </div>

      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <TipsKpiCard currency={currency} />
        <FeedbackRatingKpiCard />
        <div className="md:col-span-2">
          <DatevExportPanel />
        </div>
      </div>
    </div>
  );
}
