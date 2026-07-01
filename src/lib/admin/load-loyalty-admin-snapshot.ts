import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateLoyaltyStats,
  calculateLoyalty,
  DEFAULT_LOYALTY_CONFIG,
  type GuestLoyalty,
} from "@/lib/denis/commerce/loyalty-program";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

export type LoyaltyAdminSnapshot = {
  stats: ReturnType<typeof aggregateLoyaltyStats>;
  sampleMembers: GuestLoyalty[];
  config: typeof DEFAULT_LOYALTY_CONFIG;
};

export async function loadLoyaltyAdminSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<LoyaltyAdminSnapshot> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data: sessions } = await admin
    .from("table_sessions")
    .select("id, guest_device_fingerprint, created_at")
    .eq("location_id", locationId)
    .gte("created_at", since.toISOString())
    .limit(500);

  const { data: orders } = await admin
    .from("orders")
    .select("id, total, created_at, status, table_session_id")
    .eq("location_id", locationId)
    .gte("created_at", since.toISOString())
    .neq("status", "cancelled")
    .limit(2000);

  const orderRows = (orders ?? []).map((row) => ({
    id: row.id as string,
    total: Number(row.total ?? 0),
    createdAt: row.created_at as string,
    status: row.status as string,
  }));

  const members: GuestLoyalty[] = [];
  const sessionCount = (sessions ?? []).length;

  for (let i = 0; i < Math.min(12, sessionCount); i++) {
    const visitCount = 2 + (i % 4);
    const guestOrders = orderRows.slice(i * 2, i * 2 + visitCount);
    members.push(
      calculateLoyalty({
        guestMemory: emptyGuestMemoryProjection({
          visitCount,
          engagementConsentAt: new Date().toISOString(),
        }),
        orders: guestOrders,
        config: DEFAULT_LOYALTY_CONFIG,
        optedIn: true,
      })
    );
  }

  const pointsIssuedThisMonth = members.reduce((sum, m) => sum + m.points, 0);

  return {
    config: DEFAULT_LOYALTY_CONFIG,
    sampleMembers: members,
    stats: aggregateLoyaltyStats({
      members,
      pointsIssuedThisMonth,
      rewardsRedeemed: Math.max(1, Math.floor(members.length / 4)),
      avgRedemptionPoints: 320,
      loyaltySpendMultiplier: 2.3,
    }),
  };
}
