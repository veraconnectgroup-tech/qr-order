import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  aggregateReferralDashboardStats,
  buildReferralShareUrl,
  buildSocialProofMessage,
  isReferredWelcomeEligible,
  MAX_REFERRALS_PER_GUEST,
  REFERRAL_BONUS_POINTS,
  REFERRED_WELCOME_DISCOUNT_PERCENT,
  countReferralsByReferrer,
} from "@/lib/denis/commerce/loyalty/referral-system";
import {
  ensureReferralCode,
  loadReferralsForLocation,
  registerReferralInDb,
  resolveReferrerByCode,
  updateSocialProofOptIn,
} from "@/lib/denis/commerce/loyalty/referral-store";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const guestQuerySchema = z.object({
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
  slug: z.string().min(1).max(128).optional(),
  tableToken: z.string().min(1).max(128).optional(),
  baseUrl: z.string().url().optional(),
  orgId: zUuid().optional(),
});

const registerSchema = z.object({
  action: z.literal("register"),
  locationId: zUuid(),
  referralCode: z.string().min(4).max(16),
  referredGuestToken: z.string().min(8).max(128),
  referredDeviceFingerprint: z.string().min(8).max(128),
});

const socialProofSchema = z.object({
  action: z.literal("social_proof"),
  locationId: zUuid(),
  guestToken: z.string().min(8).max(128),
  orgId: zUuid().optional(),
  displayName: z.string().min(1).max(64).optional(),
  optIn: z.boolean(),
});

const postSchema = z.discriminatedUnion("action", [
  registerSchema,
  socialProofSchema,
]);

export const GET = withErrorHandler("commerce-referral-get", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const adminView = params.admin === "1";

  if (adminView) {
    const locationId = params.locationId;
    if (!locationId) {
      return apiError("locationId required.", 400);
    }

    const admin = createAdminClient();
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

    const stats = aggregateReferralDashboardStats({ referrals, orderTotalsById });
    return apiSuccess({ stats });
  }

  const parsed = guestQuerySchema.safeParse(params);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const { locationId, guestToken, slug, tableToken, baseUrl, orgId } = parsed.data;

  const referralCode = await ensureReferralCode(
    admin,
    locationId,
    guestToken,
    orgId
  );

  const referrals = await loadReferralsForLocation(admin, locationId);
  const referralCount = countReferralsByReferrer(referrals, guestToken);
  const welcomeEligible = isReferredWelcomeEligible(referrals, guestToken);

  let shareUrl: string | null = null;
  if (slug && tableToken && baseUrl) {
    shareUrl = buildReferralShareUrl({
      baseUrl,
      slug,
      tableToken,
      referralCode,
    });
  }

  const refCode = params.ref?.toUpperCase();
  let socialProof: string | null = null;
  if (refCode) {
    const referrer = await resolveReferrerByCode(admin, locationId, refCode);
    if (referrer?.socialProofOptIn && referrer.displayName) {
      socialProof = buildSocialProofMessage({
        friendName: referrer.displayName,
        productName: params.productName,
      });
    }
  }

  return apiSuccess({
    referralCode,
    shareUrl,
    referralCount,
    maxReferrals: MAX_REFERRALS_PER_GUEST,
    bonusPoints: REFERRAL_BONUS_POINTS,
    welcomeDiscountPercent: welcomeEligible ? REFERRED_WELCOME_DISCOUNT_PERCENT : 0,
    socialProof,
  });
});

export const POST = withErrorHandler("commerce-referral-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const body = parsed.data;

  if (body.action === "social_proof") {
    await updateSocialProofOptIn(admin, {
      locationId: body.locationId,
      guestToken: body.guestToken,
      displayName: body.displayName,
      optIn: body.optIn,
      orgId: body.orgId,
    });
    return apiSuccess({ ok: true });
  }

  const referrer = await resolveReferrerByCode(
    admin,
    body.locationId,
    body.referralCode
  );
  if (!referrer) {
    return apiError("Invalid referral code.", 400, { code: "invalid_code" });
  }

  const result = await registerReferralInDb(admin, {
    locationId: body.locationId,
    referrerGuestToken: referrer.guestToken,
    referredGuestToken: body.referredGuestToken,
    referredDeviceFingerprint: body.referredDeviceFingerprint,
    referralCode: body.referralCode.toUpperCase(),
  });

  if (!result.ok) {
    return apiError("Referral not allowed.", 400, { code: result.reason });
  }

  return apiSuccess({
    referral: result.referral,
    welcomeDiscountPercent: REFERRED_WELCOME_DISCOUNT_PERCENT,
  });
});
