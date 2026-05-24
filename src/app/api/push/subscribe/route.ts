import { z } from "zod";
import { safeJsonParse } from "@/lib/api/safe-json";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const subscribeSchema = z.object({
  locationId: z.string().uuid(),
  subscription: subscriptionSchema,
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

function pushSubscriptionsTable(admin: ReturnType<typeof createAdminClient>) {
  return admin.from("push_subscriptions" as never) as unknown as {
    upsert: (
      row: Record<string, string | null>,
      options: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
}

async function staffCanAccessLocation(
  staff: NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>,
  locationId: string
): Promise<boolean> {
  if (staff.location_id) {
    return staff.location_id === locationId;
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  return Boolean(data);
}

export const POST = withErrorHandler(
  "push-subscribe-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "push");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const { locationId, subscription } = parsed.data;

    if (!(await staffCanAccessLocation(staff, locationId))) {
      return apiError("Forbidden.", 403);
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const upsertRow: Record<string, string | null> = {
      user_id: user.id,
      staff_id: staff.id,
      location_id: locationId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    };
    const userAgent = req.headers.get("user-agent")?.slice(0, 512);
    if (userAgent) upsertRow.user_agent = userAgent;

    const { error } = await pushSubscriptionsTable(admin).upsert(upsertRow, {
      onConflict: "endpoint",
    });

    if (error) {
      return apiError(
        error.message?.includes("push_subscriptions")
          ? "Push subscriptions table missing — run database migrations."
          : "Subscription could not be saved.",
        500
      );
    }

    return apiSuccess({ ok: true });
  }
);

export const DELETE = withErrorHandler(
  "push-subscribe-delete",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "push");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const { error } = await pushSubscriptionsTable(admin)
      .delete()
      .eq("endpoint", parsed.data.endpoint)
      .eq("user_id", user.id);

    if (error) {
      return apiError("Subscription could not be removed.", 500);
    }

    return apiSuccess({ ok: true });
  }
);
