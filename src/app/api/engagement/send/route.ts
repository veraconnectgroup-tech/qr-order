import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import {
  runGuestEngagementSendAllLocations,
  runGuestEngagementSendTick,
} from "@/lib/denis/retention/run-guest-engagement-send";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { zUuid } from "@/lib/security/zod-fields";

const bodySchema = z.object({
  locationId: zUuid().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

async function authorizeCronOrAdmin(req: Request): Promise<
  | { ok: true; locationId?: string; limit?: number; cron: boolean }
  | { ok: false; response: Response }
> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, cron: true };
  }

  try {
    const staff = await requireAdmin();
    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return {
        ok: false,
        response: apiError("No location assigned.", 403),
      };
    }
    return { ok: true, locationId, cron: false };
  } catch {
    return { ok: false, response: apiError("Unauthorized", 401) };
  }
}

/** Cron/admin tick — plan + dispatch between-visit engagement (Q2). */
export const GET = withErrorHandler("engagement-send-get", async (req) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) return auth.response;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  const admin = createAdminClient();

  if (auth.cron) {
    const result = await runGuestEngagementSendAllLocations(admin, {
      limitPerLocation: Number.isFinite(limit) ? limit : 50,
    });
    logger.info("Guest engagement send tick completed", result);
    return apiSuccess(result);
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", auth.locationId!)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;
  if (!orgId) {
    return apiError("Location not found.", 404);
  }

  const result = await runGuestEngagementSendTick(admin, {
    locationId: auth.locationId!,
    orgId,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  return apiSuccess(result);
});

/** Manual send for one location (admin dashboard). */
export const POST = withErrorHandler("engagement-send-post", async (req) => {
  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const locationId = parsed.data.locationId ?? auth.locationId;

  if (!locationId) {
    return apiError("locationId required.", 400);
  }

  if (!auth.cron && parsed.data.locationId && parsed.data.locationId !== auth.locationId) {
    return apiError("Forbidden.", 403);
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;
  if (!orgId) {
    return apiError("Location not found.", 404);
  }

  const result = await runGuestEngagementSendTick(admin, {
    locationId,
    orgId,
    limit: parsed.data.limit ?? 50,
  });

  return apiSuccess(result);
});
