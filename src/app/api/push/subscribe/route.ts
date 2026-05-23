import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/session";
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

export async function POST(req: NextRequest) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const body = await req.json().catch(() => null);
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

  type PushClient = {
    from: (table: string) => {
      upsert: (
        row: Record<string, string>,
        options: { onConflict: string }
      ) => PromiseLike<{ error: unknown }>;
    };
  };

  const { error } = await (supabase as unknown as PushClient)
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        location_id: locationId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return apiError("Subscription could not be saved.", 500);
  }

  return apiSuccess({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const body = await req.json().catch(() => null);
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

  type PushClient = {
    from: (table: string) => {
      delete: () => {
        eq: (
          col: string,
          val: string
        ) => {
          eq: (
            col: string,
            val: string
          ) => PromiseLike<{ error: unknown }>;
        };
      };
    };
  };

  const { error } = await (supabase as unknown as PushClient)
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", user.id);

  if (error) {
    return apiError("Subscription could not be removed.", 500);
  }

  return apiSuccess({ ok: true });
}
