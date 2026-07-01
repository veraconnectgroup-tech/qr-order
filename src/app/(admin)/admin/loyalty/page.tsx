import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { LoyaltyDashboard } from "@/components/admin/loyalty-dashboard";
import { ReferralStatsPanel } from "@/components/admin/referral-stats-panel";
import {
  aggregateLoyaltyDashboardStats,
  aggregateReferralDashboardStats,
  type LoyaltyGuestRow,
} from "@/lib/denis/commerce/loyalty";
import { loadLoyaltyProfilesForLocation } from "@/lib/denis/commerce/loyalty/loyalty-store";
import { loadReferralsForLocation } from "@/lib/denis/commerce/loyalty/referral-store";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminLoyaltyPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const profiles = await loadLoyaltyProfilesForLocation(admin, locationId);

  const guests: LoyaltyGuestRow[] = profiles.map((profile) => ({
    guestToken: profile.guestToken,
    visitCount: profile.visitCount,
    totalSpent: profile.totalSpent,
    points: profile.pointsBalance,
    level: profile.guestLevel,
    lastVisitAt: profile.visitDates[0] ?? null,
  }));

  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data: txRows } = await admin
    .from("loyalty_transactions" as never)
    .select("type, points")
    .eq("location_id", locationId)
    .gte("created_at", since.toISOString());

  let pointsIssued = 0;
  let pointsRedeemed = 0;
  for (const row of (txRows ?? []) as Array<{ type: string; points: number }>) {
    const pts = Number(row.points ?? 0);
    if (row.type === "earn") pointsIssued += pts;
    if (row.type === "redeem") pointsRedeemed += Math.abs(pts);
  }

  const stats = aggregateLoyaltyDashboardStats({
    guests,
    pointsIssued,
    pointsRedeemed,
    loyaltySpendMultiplier: 2.3,
  });

  const referrals = await loadReferralsForLocation(admin, locationId);
  const orderIds = referrals
    .map((r) => r.firstOrderId)
    .filter((id): id is string => !!id);

  const orderTotalsById: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("id, total")
      .in("id", orderIds);

    for (const row of (orders ?? []) as Array<{ id: string; total: number }>) {
      orderTotalsById[row.id] = Number(row.total ?? 0);
    }
  }

  const referralStats = aggregateReferralDashboardStats({
    referrals,
    orderTotalsById,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Loyalty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest levels, points, streaks i retention.
        </p>
      </div>
      <LoyaltyDashboard stats={stats} />
      <ReferralStatsPanel stats={referralStats} />
    </div>
  );
}
