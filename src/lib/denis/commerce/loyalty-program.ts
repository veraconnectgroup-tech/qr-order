import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

export type LoyaltyTier = {
  name: string;
  minPoints: number;
  perks: string[];
  badge: string;
};

export type LoyaltyReward = {
  id: string;
  name: string;
  pointsCost: number;
  productId: string | null;
  type: "free_item" | "discount_percent" | "discount_flat";
  value: number;
};

export type LoyaltyConfig = {
  enabled: boolean;
  pointsPerCurrency: number;
  /** Major currency units per point batch (e.g. 100 RSD → 1 point). */
  currencyUnit: number;
  tiers: LoyaltyTier[];
  rewards: LoyaltyReward[];
  pointsExpireDays: number | null;
  optInRequired: boolean;
};

export type GuestLoyalty = {
  points: number;
  tier: LoyaltyTier;
  availableRewards: LoyaltyReward[];
  nextTierIn: number;
  history: { date: string; points: number; reason: string }[];
  optedIn: boolean;
};

export type OrderRow = {
  id: string;
  total: number;
  createdAt: string;
  status?: string;
};

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: true,
  pointsPerCurrency: 1,
  currencyUnit: 100,
  optInRequired: true,
  pointsExpireDays: null,
  tiers: [
    {
      name: "Bronze",
      minPoints: 0,
      perks: ["5% popust na posebne ponude"],
      badge: "🥉",
    },
    {
      name: "Silver",
      minPoints: 500,
      perks: ["10% popust na svaku posjetu"],
      badge: "🥈",
    },
    {
      name: "Gold",
      minPoints: 1500,
      perks: ["15% popust automatski primjenjen", "Prioritet u redu"],
      badge: "🥇",
    },
  ],
  rewards: [
    {
      id: "free-coffee",
      name: "Besplatna kafa",
      pointsCost: 200,
      productId: null,
      type: "free_item",
      value: 1,
    },
    {
      id: "10pct-off",
      name: "10% popust",
      pointsCost: 350,
      productId: null,
      type: "discount_percent",
      value: 10,
    },
  ],
};

function pointsFromOrderTotal(total: number, config: LoyaltyConfig): number {
  if (total <= 0) return 0;
  const batches = Math.floor(total / config.currencyUnit);
  return batches * config.pointsPerCurrency;
}

function resolveTier(points: number, tiers: LoyaltyTier[]): LoyaltyTier {
  const sorted = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find((tier) => points >= tier.minPoints) ?? sorted[sorted.length - 1]!;
}

function nextTierGap(points: number, tiers: LoyaltyTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const next = sorted.find((tier) => tier.minPoints > points);
  if (!next) return 0;
  return Math.max(0, next.minPoints - points);
}

function buildHistoryFromOrders(orders: OrderRow[], config: LoyaltyConfig) {
  return orders
    .filter((order) => order.status !== "cancelled")
    .map((order) => ({
      date: order.createdAt,
      points: pointsFromOrderTotal(order.total, config),
      reason: `Narudžba ${order.id.slice(0, 8)}`,
    }))
    .filter((row) => row.points > 0);
}

export function calculateLoyalty(input: {
  guestMemory: GuestMemoryProjection;
  orders: OrderRow[];
  config: LoyaltyConfig;
  optedIn?: boolean;
}): GuestLoyalty {
  const { guestMemory, orders, config } = input;
  const optedIn = input.optedIn ?? !config.optInRequired;

  if (!config.enabled || !optedIn) {
    const baseTier = resolveTier(0, config.tiers);
    return {
      points: 0,
      tier: baseTier,
      availableRewards: [],
      nextTierIn: nextTierGap(0, config.tiers),
      history: [],
      optedIn,
    };
  }

  const history = buildHistoryFromOrders(orders, config);
  const points = history.reduce((sum, row) => sum + row.points, 0);
  const tier = resolveTier(points, config.tiers);
  const availableRewards = config.rewards.filter(
    (reward) => reward.pointsCost <= points
  );

  return {
    points,
    tier,
    availableRewards,
    nextTierIn: nextTierGap(points, config.tiers),
    history,
    optedIn,
  };
}

export function shouldOfferLoyaltyToGuest(guestMemory: GuestMemoryProjection): boolean {
  return guestMemory.visitCount > 1;
}

export function buildReturningGuestLoyaltyMessage(input: {
  loyalty: GuestLoyalty;
  guestName?: string | null;
  language?: string;
}): string | null {
  if (!input.loyalty.optedIn || input.loyalty.points === 0) return null;

  const lang = (input.language ?? "sr").slice(0, 2);
  const name = input.guestName?.trim();
  const { tier, points, nextTierIn } = input.loyalty;

  if (lang === "en") {
    const greet = name ? `Welcome back, ${name}!` : "Welcome back!";
    const next =
      nextTierIn > 0
        ? ` ${nextTierIn} points until the next tier.`
        : "";
    return `${greet} ${tier.badge} You have ${points} ${tier.name} points.${next}`;
  }

  const greet = name ? `Dobrodošli nazad, ${name}!` : "Dobrodošli nazad!";
  const next =
    nextTierIn > 0
      ? ` Još ${nextTierIn} do ${resolveNextTierName(tier, input.loyalty)} tier-a.`
      : "";
  return `${greet} ${tier.badge} Imate ${points} ${tier.name} bodova.${next}`;
}

function resolveNextTierName(current: LoyaltyTier, loyalty: GuestLoyalty): string {
  const idx = DEFAULT_LOYALTY_CONFIG.tiers.findIndex((t) => t.name === current.name);
  const next = DEFAULT_LOYALTY_CONFIG.tiers[idx + 1];
  return next?.name ?? "Gold";
}

export function buildOrderPointsEarnedMessage(input: {
  earned: number;
  totalPoints: number;
  loyalty: GuestLoyalty;
  language?: string;
}): string {
  const lang = (input.language ?? "sr").slice(0, 2);
  const reward = input.loyalty.availableRewards[0];

  if (lang === "en") {
    const rewardHint = reward
      ? ` Redeem for: ${reward.name} (${reward.pointsCost} points).`
      : "";
    return `You earned ${input.earned} points! Total: ${input.totalPoints}.${rewardHint}`;
  }

  const rewardHint = reward
    ? ` Možete zamijeniti za: ${reward.name} (${reward.pointsCost} bodova).`
    : "";
  return `Zaradili ste ${input.earned} bodova! Ukupno: ${input.totalPoints}.${rewardHint}`;
}

export type LoyaltyProgramStats = {
  totalMembers: number;
  byTier: Record<string, number>;
  pointsIssuedThisMonth: number;
  rewardsRedeemed: number;
  avgRedemptionPoints: number;
  loyaltySpendMultiplier: number;
};

export function aggregateLoyaltyStats(input: {
  members: GuestLoyalty[];
  pointsIssuedThisMonth: number;
  rewardsRedeemed: number;
  avgRedemptionPoints: number;
  loyaltySpendMultiplier?: number;
}): LoyaltyProgramStats {
  const byTier: Record<string, number> = {};
  for (const member of input.members) {
    byTier[member.tier.name] = (byTier[member.tier.name] ?? 0) + 1;
  }

  return {
    totalMembers: input.members.length,
    byTier,
    pointsIssuedThisMonth: input.pointsIssuedThisMonth,
    rewardsRedeemed: input.rewardsRedeemed,
    avgRedemptionPoints: input.avgRedemptionPoints,
    loyaltySpendMultiplier: input.loyaltySpendMultiplier ?? 2.3,
  };
}
