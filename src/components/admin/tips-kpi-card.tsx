import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sumTips } from "@/lib/orders/tips";
import { formatPrice } from "@/lib/format";

export async function TipsKpiCard({ currency }: { currency: string }) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return null;

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: orders } = await admin
    .from("orders")
    .select("tip_amount, payment_status")
    .eq("location_id", locationId)
    .gte("created_at", since.toISOString())
    .neq("status", "cancelled");

  const paid = (orders ?? []).filter((o) =>
    ["paid", "partial_refund"].includes(
      (o as { payment_status: string }).payment_status
    )
  );
  const totalTips = sumTips(paid as Array<{ tip_amount?: number }>);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">Ukupan Trinkgeld (30 dana)</p>
      <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">
        {formatPrice(totalTips, currency)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        MwSt-frei · samo plaćene porudžbine
      </p>
    </div>
  );
}
