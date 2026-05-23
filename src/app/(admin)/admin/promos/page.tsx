import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PromoManager } from "@/components/admin/promo-manager";
import type { PromoCode } from "@/types";

export default async function AdminPromosPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Location not found.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: promos }, { data: org }] = await Promise.all([
    admin
      .from("promo_codes")
      .select("*")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false }),
    admin
      .from("organizations")
      .select("currency")
      .eq("id", staff.org_id)
      .single(),
  ]);

  const currency =
    (org as { currency: string } | null)?.currency ?? "EUR";

  return (
    <div className="p-6">
      <PromoManager promos={(promos ?? []) as PromoCode[]} currency={currency} />
    </div>
  );
}
