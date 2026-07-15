import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { FeedbackPanel } from "@/components/admin/feedback-panel";
import { loadLocationFeedback } from "@/components/admin/feedback-rating-kpi-card";
import { FeedbackInboxPanel } from "@/components/admin/feedback-inbox-panel";
import { loadFeedbackInboxNeedingResponse } from "@/lib/feedback/feedback-inbox-store";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminFeedbackPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Location not found.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [feedback, inboxItems] = await Promise.all([
    loadLocationFeedback(locationId),
    loadFeedbackInboxNeedingResponse(admin, locationId),
  ]);

  return (
    <div className="space-y-6 p-6">
      <FeedbackInboxPanel items={inboxItems} />
      <FeedbackPanel feedback={feedback} />
    </div>
  );
}
