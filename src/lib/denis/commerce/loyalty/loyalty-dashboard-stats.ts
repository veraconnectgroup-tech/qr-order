import { resolveGuestLevel, type GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";

export type LoyaltyGuestRow = {
  guestToken: string;
  visitCount: number;
  totalSpent: number;
  points: number;
  level: GuestLevelId;
  lastVisitAt: string | null;
};

export type LoyaltyDashboardStats = {
  totalGuests: number;
  byLevel: Record<GuestLevelId, number>;
  retentionRate: number;
  topByVisits: LoyaltyGuestRow[];
  topBySpend: LoyaltyGuestRow[];
  pointsIssued: number;
  pointsRedeemed: number;
  loyaltySpendMultiplier: number;
};

export function aggregateLoyaltyDashboardStats(input: {
  guests: LoyaltyGuestRow[];
  pointsIssued?: number;
  pointsRedeemed?: number;
  returningGuestCount?: number;
  loyaltySpendMultiplier?: number;
}): LoyaltyDashboardStats {
  const byLevel: Record<GuestLevelId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (const guest of input.guests) {
    const level = resolveGuestLevel({
      visitCount: guest.visitCount,
      totalSpent: guest.totalSpent,
    }).id;
    byLevel[level] += 1;
  }

  const returning = input.returningGuestCount ?? input.guests.filter((g) => g.visitCount > 1).length;
  const total = input.guests.length;
  const retentionRate =
    total > 0 ? Math.round((returning / total) * 100) : 0;

  const topByVisits = [...input.guests]
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 5);
  const topBySpend = [...input.guests]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  return {
    totalGuests: total,
    byLevel,
    retentionRate,
    topByVisits,
    topBySpend,
    pointsIssued: input.pointsIssued ?? 0,
    pointsRedeemed: input.pointsRedeemed ?? 0,
    loyaltySpendMultiplier: input.loyaltySpendMultiplier ?? 2.3,
  };
}
