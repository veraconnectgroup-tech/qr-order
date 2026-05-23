import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { FeedbackPanel } from "@/components/admin/feedback-panel";
import { loadLocationFeedback } from "@/components/admin/feedback-rating-kpi-card";

export default async function AdminFeedbackPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Location not found.</p>
      </div>
    );
  }

  const feedback = await loadLocationFeedback(locationId);

  return (
    <div className="p-6">
      <FeedbackPanel feedback={feedback} />
    </div>
  );
}
