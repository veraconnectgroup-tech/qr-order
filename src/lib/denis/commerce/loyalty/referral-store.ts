import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyReferralBonusesOnFirstOrder,
  generateReferralCode,
  REFERRAL_BONUS_POINTS,
  registerReferral,
  type LoyaltyReferral,
} from "@/lib/denis/commerce/loyalty/referral-system";
import { loadLoyaltyProfile, upsertLoyaltyProfile } from "@/lib/denis/commerce/loyalty/loyalty-store";

type ReferralRow = {
  id: string;
  location_id: string;
  referrer_guest_token: string;
  referred_guest_token: string;
  referrer_device_fingerprint: string | null;
  referred_device_fingerprint: string | null;
  referral_code: string | null;
  bonus_applied: boolean;
  referred_welcome_applied: boolean;
  first_order_id: string | null;
  created_at: string;
};

type ProfileReferralRow = {
  guest_token: string;
  referral_code: string | null;
  referral_display_name: string | null;
  social_proof_opt_in: boolean;
};

function mapReferralRow(row: ReferralRow): LoyaltyReferral {
  return {
    id: row.id,
    referrerGuestToken: row.referrer_guest_token,
    referredGuestToken: row.referred_guest_token,
    referrerDeviceFingerprint: row.referrer_device_fingerprint ?? undefined,
    referredDeviceFingerprint: row.referred_device_fingerprint ?? undefined,
    referralCode: row.referral_code ?? undefined,
    bonusApplied: row.bonus_applied,
    referredWelcomeApplied: row.referred_welcome_applied,
    firstOrderId: row.first_order_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function loadReferralsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<LoyaltyReferral[]> {
  const { data } = await admin
    .from("loyalty_referrals" as never)
    .select("*")
    .eq("location_id", locationId);

  return ((data ?? []) as ReferralRow[]).map(mapReferralRow);
}

export async function ensureReferralCode(
  admin: SupabaseClient,
  locationId: string,
  guestToken: string,
  orgId?: string
): Promise<string> {
  const { data: existing } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("referral_code, org_id")
    .eq("location_id", locationId)
    .eq("guest_token", guestToken)
    .maybeSingle();

  const row = existing as { referral_code: string | null; org_id: string } | null;
  if (row?.referral_code) return row.referral_code;

  const code = generateReferralCode(guestToken, locationId);

  if (row) {
    await admin
      .from("guest_loyalty_profiles" as never)
      .update({ referral_code: code, updated_at: new Date().toISOString() } as never)
      .eq("location_id", locationId)
      .eq("guest_token", guestToken);
    return code;
  }

  if (orgId) {
    await upsertLoyaltyProfile(admin, {
      orgId,
      locationId,
      guestToken,
      visitCount: 0,
      totalSpent: 0,
    });
    await admin
      .from("guest_loyalty_profiles" as never)
      .update({ referral_code: code, updated_at: new Date().toISOString() } as never)
      .eq("location_id", locationId)
      .eq("guest_token", guestToken);
  }

  return code;
}

export async function resolveReferrerByCode(
  admin: SupabaseClient,
  locationId: string,
  referralCode: string
): Promise<{ guestToken: string; displayName: string | null; socialProofOptIn: boolean } | null> {
  const { data } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("guest_token, referral_display_name, social_proof_opt_in")
    .eq("location_id", locationId)
    .eq("referral_code", referralCode.toUpperCase())
    .maybeSingle();

  if (!data) return null;

  const row = data as ProfileReferralRow;
  return {
    guestToken: row.guest_token,
    displayName: row.referral_display_name,
    socialProofOptIn: row.social_proof_opt_in,
  };
}

export async function registerReferralInDb(
  admin: SupabaseClient,
  input: {
    locationId: string;
    referrerGuestToken: string;
    referredGuestToken: string;
    referrerDeviceFingerprint?: string;
    referredDeviceFingerprint?: string;
    referralCode?: string;
  }
): Promise<
  | { ok: true; referral: LoyaltyReferral }
  | { ok: false; reason: string }
> {
  const existing = await loadReferralsForLocation(admin, input.locationId);

  const result = registerReferral({
    ...input,
    existingReferrals: existing,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  await admin.from("loyalty_referrals" as never).insert({
    id: result.referral.id,
    location_id: input.locationId,
    referrer_guest_token: result.referral.referrerGuestToken,
    referred_guest_token: result.referral.referredGuestToken,
    referrer_device_fingerprint: input.referrerDeviceFingerprint ?? null,
    referred_device_fingerprint: input.referredDeviceFingerprint ?? null,
    referral_code: input.referralCode ?? null,
    bonus_applied: false,
    referred_welcome_applied: false,
  } as never);

  return { ok: true, referral: result.referral };
}

export async function applyReferralFirstOrderBonuses(
  admin: SupabaseClient,
  input: {
    locationId: string;
    referredGuestToken: string;
    orderId: string;
    orderTotalEuros: number;
    orgId: string;
  }
): Promise<{
  referrerBonusPoints: number;
  referredBonusPoints: number;
  welcomeDiscountPercent: number;
}> {
  const referrals = await loadReferralsForLocation(admin, input.locationId);
  const bonus = applyReferralBonusesOnFirstOrder(
    referrals,
    input.referredGuestToken,
    input.orderId
  );

  if (!bonus.referrerGuestToken) {
    return {
      referrerBonusPoints: 0,
      referredBonusPoints: 0,
      welcomeDiscountPercent: 0,
    };
  }

  const pending = referrals.find(
    (r) =>
      r.referredGuestToken === input.referredGuestToken && !r.bonusApplied
  );
  if (!pending) {
    return {
      referrerBonusPoints: 0,
      referredBonusPoints: 0,
      welcomeDiscountPercent: 0,
    };
  }

  await admin
    .from("loyalty_referrals" as never)
    .update({
      bonus_applied: true,
      referred_welcome_applied: true,
      first_order_id: input.orderId,
      referrer_bonus_points: bonus.referrerBonusPoints,
    } as never)
    .eq("id", pending.id);

  const referrerProfile = await loadLoyaltyProfile(
    admin,
    input.locationId,
    bonus.referrerGuestToken
  );

  if (referrerProfile) {
    await admin.from("loyalty_transactions" as never).insert({
      profile_id: referrerProfile.profileId,
      location_id: input.locationId,
      guest_token: bonus.referrerGuestToken,
      type: "earn",
      points: bonus.referrerBonusPoints,
      reason: "referral",
      order_id: input.orderId,
      metadata: { referredGuestToken: input.referredGuestToken },
    } as never);

    await admin
      .from("guest_loyalty_profiles" as never)
      .update({
        points: referrerProfile.pointsBalance + bonus.referrerBonusPoints,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", referrerProfile.profileId);
  }

  const referredProfile = await loadLoyaltyProfile(
    admin,
    input.locationId,
    input.referredGuestToken
  );

  if (referredProfile) {
    await admin.from("loyalty_transactions" as never).insert({
      profile_id: referredProfile.profileId,
      location_id: input.locationId,
      guest_token: input.referredGuestToken,
      type: "earn",
      points: bonus.referredBonusPoints,
      reason: "referral",
      order_id: input.orderId,
      metadata: { welcomeBonus: true },
    } as never);

    await admin
      .from("guest_loyalty_profiles" as never)
      .update({
        points: referredProfile.pointsBalance + bonus.referredBonusPoints,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", referredProfile.profileId);
  } else {
    await upsertLoyaltyProfile(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      guestToken: input.referredGuestToken,
      visitCount: 1,
      totalSpent: input.orderTotalEuros,
      points: bonus.referredBonusPoints,
    });
  }

  return {
    referrerBonusPoints: bonus.referrerBonusPoints,
    referredBonusPoints: bonus.referredBonusPoints,
    welcomeDiscountPercent: bonus.welcomeDiscountPercent,
  };
}

export async function updateSocialProofOptIn(
  admin: SupabaseClient,
  input: {
    locationId: string;
    guestToken: string;
    displayName?: string;
    optIn: boolean;
    orgId?: string;
  }
): Promise<void> {
  const { data: existing } = await admin
    .from("guest_loyalty_profiles" as never)
    .select("id")
    .eq("location_id", input.locationId)
    .eq("guest_token", input.guestToken)
    .maybeSingle();

  if (!existing && input.orgId) {
    await upsertLoyaltyProfile(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      guestToken: input.guestToken,
      visitCount: 0,
      totalSpent: 0,
    });
  }

  await admin
    .from("guest_loyalty_profiles" as never)
    .update({
      social_proof_opt_in: input.optIn,
      referral_display_name: input.displayName?.trim() || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("location_id", input.locationId)
    .eq("guest_token", input.guestToken);
}

export { REFERRAL_BONUS_POINTS };
