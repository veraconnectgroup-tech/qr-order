import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  buildReferralShareUrl,
  REDEEM_POINTS_COST,
} from "@/lib/denis/commerce/loyalty";
import {
  loadLoyaltyProfile,
  loadLoyaltyProfilesForLocation,
  recordLoyaltyEarn,
  recordLoyaltyRedeem,
  upsertLoyaltyProfile,
} from "@/lib/denis/commerce/loyalty/loyalty-store";
import {
  applyReferralFirstOrderBonuses,
  ensureReferralCode,
  registerReferralInDb,
} from "@/lib/denis/commerce/loyalty/referral-store";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const profileQuerySchema = z.object({
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
});

const earnSchema = z.object({
  action: z.literal("earn"),
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
  orgId: zUuid(),
  visitCount: z.number().int().min(0),
  totalSpent: z.number().min(0),
  orderTotalEuros: z.number().min(0),
  isFirstVisit: z.boolean().optional(),
  isBirthday: z.boolean().optional(),
  orderId: zUuid().optional(),
});

const redeemSchema = z.object({
  action: z.literal("redeem"),
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
});

const referralSchema = z.object({
  action: z.literal("referral"),
  locationId: zUuid(),
  referrerGuestToken: z.string().min(8).max(128),
  referredGuestToken: z.string().min(8).max(128),
});

const syncSchema = z.object({
  action: z.literal("sync"),
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
  orgId: zUuid(),
  visitCount: z.number().int().min(0),
  totalSpent: z.number().min(0),
  points: z.number().int().min(0).optional(),
});

const postSchema = z.discriminatedUnion("action", [
  earnSchema,
  redeemSchema,
  referralSchema,
  syncSchema,
]);

export const GET = withErrorHandler("commerce-loyalty-get", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const locationId = req.nextUrl.searchParams.get("locationId");
  const guestToken = req.nextUrl.searchParams.get("guestToken");
  const adminView = req.nextUrl.searchParams.get("admin") === "1";

  if (!locationId) {
    return apiError("locationId required.", 400);
  }

  const admin = createAdminClient();

  if (adminView && !guestToken) {
    const profiles = await loadLoyaltyProfilesForLocation(admin, locationId);
    return apiSuccess({ profiles, redeemCost: REDEEM_POINTS_COST });
  }

  if (!guestToken) {
    return apiError("guestToken required.", 400);
  }

  const parsed = profileQuerySchema.safeParse({ locationId, guestToken });
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const profile = await loadLoyaltyProfile(admin, locationId, guestToken);
  return apiSuccess({
    profile,
    redeemCost: REDEEM_POINTS_COST,
  });
});

export const POST = withErrorHandler("commerce-loyalty-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const body = parsed.data;

  if (body.action === "sync") {
    const profile = await upsertLoyaltyProfile(admin, {
      orgId: body.orgId,
      locationId: body.locationId,
      guestToken: body.guestToken,
      visitCount: body.visitCount,
      totalSpent: body.totalSpent,
      points: body.points,
    });
    return apiSuccess({ profile });
  }

  if (body.action === "earn") {
    const profile = await upsertLoyaltyProfile(admin, {
      orgId: body.orgId,
      locationId: body.locationId,
      guestToken: body.guestToken,
      visitCount: body.visitCount,
      totalSpent: body.totalSpent,
    });

    const { profile: updated, earned } = await recordLoyaltyEarn(admin, {
      profileId: profile.profileId,
      locationId: body.locationId,
      guestToken: body.guestToken,
      orderTotalEuros: body.orderTotalEuros,
      isFirstVisit: body.isFirstVisit ?? false,
      isBirthday: body.isBirthday ?? false,
      streakTier: profile.streakMultiplier >= 2 ? 4 : profile.streakMultiplier >= 1.5 ? 2 : 0,
      orderId: body.orderId,
    });

    let referralBonus = {
      referrerBonusPoints: 0,
      referredBonusPoints: 0,
      welcomeDiscountPercent: 0,
    };

    if (body.isFirstVisit && body.orderId) {
      referralBonus = await applyReferralFirstOrderBonuses(admin, {
        locationId: body.locationId,
        referredGuestToken: body.guestToken,
        orderId: body.orderId,
        orderTotalEuros: body.orderTotalEuros,
        orgId: body.orgId,
      });
    }

    return apiSuccess({
      profile: updated,
      earned: earned + referralBonus.referredBonusPoints,
      referralBonus,
    });
  }

  if (body.action === "redeem") {
    const profile = await loadLoyaltyProfile(
      admin,
      body.locationId,
      body.guestToken
    );
    if (!profile) {
      return apiError("Profile not found.", 404);
    }

    const result = await recordLoyaltyRedeem(admin, {
      profileId: profile.profileId,
      locationId: body.locationId,
      guestToken: body.guestToken,
    });

    if (!result.ok) {
      return apiError(`Need ${REDEEM_POINTS_COST} points to redeem.`, 400);
    }

    return apiSuccess({
      profile: result.profile,
      discountEuros: result.discountEuros,
    });
  }

  const result = await registerReferralInDb(admin, {
    locationId: body.locationId,
    referrerGuestToken: body.referrerGuestToken,
    referredGuestToken: body.referredGuestToken,
  });

  if (!result.ok) {
    return apiError("Referral not allowed.", 400, { code: result.reason });
  }

  return apiSuccess({ referral: result.referral });
});

export const PUT = withErrorHandler("commerce-loyalty-put", async (req) => {
  const limited = await withRateLimit(req, "sessions");
  if (limited) return limited;

  const body = (await req.json()) as {
    locationId?: string;
    slug?: string;
    guestToken?: string;
    tableToken?: string;
    baseUrl?: string;
    orgId?: string;
  };

  if (!body.locationId || !body.guestToken || !body.slug || !body.baseUrl) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const referralCode = await ensureReferralCode(
    admin,
    body.locationId,
    body.guestToken,
    body.orgId
  );

  const shareUrl = buildReferralShareUrl({
    baseUrl: body.baseUrl,
    slug: body.slug,
    tableToken: body.tableToken ?? body.guestToken.slice(0, 12),
    referralCode,
  });

  return apiSuccess({ shareUrl, referralCode });
});
