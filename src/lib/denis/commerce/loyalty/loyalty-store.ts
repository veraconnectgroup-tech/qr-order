import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLoyaltyContextSnapshot,
  detectStreak,
  earnPointsFromOrder,
  redeemPoints,
  resolveGuestLevel,
  resolveWaitlistPriorityBoost,
  type GuestLevelId,
  type LoyaltyContextSnapshot,
} from "@/lib/denis/commerce/loyalty";

export type LoyaltyProfileRow = {
  id: string;
  org_id: string;
  location_id: string;
  guest_token: string;
  level: GuestLevelId;
  points: number;
  total_spent: number;
  visit_count: number;
  streak_tier: number;
  streak_count: number;
  last_visit_at: string | null;
  previous_level: GuestLevelId | null;
  level_up_at: string | null;
};

export type LoyaltyProfileView = LoyaltyContextSnapshot & {
  profileId: string;
  guestToken: string;
  visitCount: number;
  totalSpent: number;
  waitlistPriorityBoost: number;
  visitDates: string[];
};

function mapRow(row: LoyaltyProfileRow): LoyaltyProfileView {
  const visitCount = row.visit_count;
  const totalSpent = Number(row.total_spent);
  const level = resolveGuestLevel({ visitCount, totalSpent });
  const visitDates = row.last_visit_at ? [row.last_visit_at] : [];
  const streak = detectStreak(visitDates);

  const snapshot = buildLoyaltyContextSnapshot({
    visitCount,
    totalSpent,
    pointsBalance: row.points,
    visitDates,
    previousLevel: row.previous_level ?? undefined,
  });

  return {
    ...snapshot,
    profileId: row.id,
    guestToken: row.guest_token,
    visitCount,
    totalSpent,
    waitlistPriorityBoost: resolveWaitlistPriorityBoost(level.id),
    visitDates,
    streakCount: streak.visitCountInWindow,
    streakLabel: streak.label,
    streakMultiplier: streak.multiplier,
  };
}

export async function loadLoyaltyProfile(
  admin: SupabaseClient,
  locationId: string,
  guestToken: string
): Promise<LoyaltyProfileView | null> {
  const { data } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("*")
    .eq("location_id", locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as LoyaltyProfileRow);
}

export async function upsertLoyaltyProfile(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    guestToken: string;
    visitCount: number;
    totalSpent: number;
    points?: number;
    visitDates?: string[];
  }
): Promise<LoyaltyProfileView> {
  const level = resolveGuestLevel({
    visitCount: input.visitCount,
    totalSpent: input.totalSpent,
  });
  const streak = detectStreak(input.visitDates ?? []);
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("id, level, points")
    .eq("location_id", input.locationId)
    .eq("guest_token", input.guestToken)
    .maybeSingle();

  const existingRow = existing as { id: string; level: number; points: number } | null;
  const previousLevel = (existingRow?.level as GuestLevelId | undefined) ?? null;
  const levelUp = previousLevel != null && level.id > previousLevel;

  const payload = {
    org_id: input.orgId,
    location_id: input.locationId,
    guest_token: input.guestToken,
    level: level.id,
    points: input.points ?? existingRow?.points ?? 0,
    total_spent: input.totalSpent,
    visit_count: input.visitCount,
    streak_tier: streak.tier,
    streak_count: streak.visitCountInWindow,
    last_visit_at: input.visitDates?.[0] ?? now,
    previous_level: previousLevel,
    level_up_at: levelUp ? now : undefined,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("guest_loyalty_profiles" as never)
    .upsert(payload as never, { onConflict: "location_id,guest_token" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert loyalty profile");
  }

  return mapRow(data as LoyaltyProfileRow);
}

export async function recordLoyaltyEarn(
  admin: SupabaseClient,
  input: {
    profileId: string;
    locationId: string;
    guestToken: string;
    orderTotalEuros: number;
    isFirstVisit: boolean;
    isBirthday?: boolean;
    streakTier: 0 | 2 | 4;
    orderId?: string;
  }
): Promise<{ profile: LoyaltyProfileView; earned: number }> {
  const { data: profile } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("*")
    .eq("id", input.profileId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const row = profile as LoyaltyProfileRow;
  const result = earnPointsFromOrder(
    {
      orderTotalEuros: input.orderTotalEuros,
      isFirstVisit: input.isFirstVisit,
      isBirthday: input.isBirthday ?? false,
      streakTier: input.streakTier,
    },
    row.points
  );

  if (result.transactions.length > 0) {
    await admin.from("loyalty_transactions" as never).insert(
      result.transactions.map((tx) => ({
        profile_id: input.profileId,
        location_id: input.locationId,
        guest_token: input.guestToken,
        type: tx.type,
        points: tx.points,
        reason: tx.reason,
        order_id: input.orderId ?? null,
      })) as never
    );
  }

  await admin
    .from("guest_loyalty_profiles" as never)
    .update({ points: result.newBalance, updated_at: new Date().toISOString() } as never)
    .eq("id", input.profileId);

  const updated = await loadLoyaltyProfile(admin, input.locationId, input.guestToken);
  if (!updated) throw new Error("Profile reload failed");

  return { profile: updated, earned: result.totalEarned };
}

export async function recordLoyaltyRedeem(
  admin: SupabaseClient,
  input: {
    profileId: string;
    locationId: string;
    guestToken: string;
  }
): Promise<{ ok: boolean; profile: LoyaltyProfileView; discountEuros: number }> {
  const { data: profile } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("*")
    .eq("id", input.profileId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const row = profile as LoyaltyProfileRow;
  const result = redeemPoints(row.points);

  if (!result.ok || !result.transaction) {
    const view = await loadLoyaltyProfile(admin, input.locationId, input.guestToken);
    return { ok: false, profile: view!, discountEuros: 0 };
  }

  await admin.from("loyalty_transactions" as never).insert({
    profile_id: input.profileId,
    location_id: input.locationId,
    guest_token: input.guestToken,
    type: "redeem",
    points: result.transaction.points,
    reason: result.transaction.reason,
  } as never);

  await admin
    .from("guest_loyalty_profiles" as never)
    .update({
      points: result.newBalance,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.profileId);

  const updated = await loadLoyaltyProfile(admin, input.locationId, input.guestToken);
  return { ok: true, profile: updated!, discountEuros: result.discountEuros };
}

export async function loadLoyaltyRewardsForLevel(
  admin: SupabaseClient,
  locationId: string,
  level: GuestLevelId
): Promise<{ rewardType: string; rewardValue: string }[]> {
  const { data } = await admin
    .from("loyalty_rewards" as never)
    .select("location_id, reward_type, reward_value")
    .eq("level", level)
    .eq("is_active", true)
    .or(`location_id.eq.${locationId},location_id.is.null`);

  const rows = (data ?? []) as {
    location_id: string | null;
    reward_type: string;
    reward_value: string;
  }[];

  const byType = new Map<string, { rewardType: string; rewardValue: string }>();
  for (const row of rows) {
    const existing = byType.get(row.reward_type);
    const isLocationSpecific = row.location_id === locationId;
    if (!existing || isLocationSpecific) {
      byType.set(row.reward_type, {
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
      });
    }
  }

  return Array.from(byType.values());
}

export async function loadLoyaltyProfilesForLocation(
  admin: SupabaseClient,
  locationId: string,
  limit = 200
): Promise<LoyaltyProfileView[]> {
  const { data } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("*")
    .eq("location_id", locationId)
    .order("visit_count", { ascending: false })
    .limit(limit);

  return ((data ?? []) as LoyaltyProfileRow[]).map(mapRow);
}
