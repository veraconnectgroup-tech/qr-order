import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sumTips } from "@/lib/orders/tips";
import { formatPrice } from "@/lib/format";
import { formatAnalyticsRangeLabel, type AnalyticsDateRange } from "@/lib/analytics/date-range";

export async function TipsKpiCard({
  currency,
  range,
}: {
  currency: string;
  range: AnalyticsDateRange;
}) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return null;

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("tip_amount, payment_status")
    .eq("location_id", locationId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .not("status", "in", '("cancelled","rejected")');

  const paid = (orders ?? []).filter((o) =>
    ["paid", "partial_refund"].includes(
      (o as { payment_status: string }).payment_status
    )
  );
  const totalTips = sumTips(paid as Array<{ tip_amount?: number }>);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">
        Total tips ({formatAnalyticsRangeLabel(range).toLowerCase()})
      </p>
      <p className="mt-2 font-mono text-3xl font-bold text-foreground">
        {formatPrice(totalTips, currency)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        VAT-free · paid orders only
      </p>
    </div>
  );
}
