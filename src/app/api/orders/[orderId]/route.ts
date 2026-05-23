
import { z } from "zod";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { enqueue } from "@/lib/queue/client";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { zOrderNotesOptional, zSessionToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { processRefund } from "@/lib/stripe/refund";

function parseSessionToken(value: string | null) {
  return zSessionToken().safeParse(value ?? "");
}

export const GET = withErrorHandler(
  "orders-orderId-get",
  async (req, ctx) => {
    const cacheHeaders = noCache();
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const { orderId } = await ctx.params;

    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400, undefined, cacheHeaders);
    }

    const sessionParsed = parseSessionToken(
      req.nextUrl.searchParams.get("sessionToken")
    );
    if (!sessionParsed.success) {
      return apiError("Unauthorized.", 401, undefined, cacheHeaders);
    }
    const sessionToken = sessionParsed.data;

    const admin = createAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("*, order_items(*, order_item_modifiers(*)), tables(name)")
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Not found.", 404, undefined, cacheHeaders);
    }

    const orderBase = order as unknown as {
      session_id: string | null;
      id: string;
      order_number: number;
      status: string;
      payment_status: string;
      subtotal: number;
      tax_amount: number;
      tax_percent: number;
      total: number;
      rejection_reason: string | null;
      estimated_prep_minutes: number | null;
      created_at: string;
      accepted_at: string | null;
      preparing_at: string | null;
      ready_at: string | null;
      delivered_at: string | null;
      order_items: Array<{
        product_name: string;
        quantity: number;
        total: number;
        notes: string | null;
        order_item_modifiers: Array<{ modifier_name: string; price: number }>;
      }>;
      tables: { name: string } | null;
    };

    if (!orderBase.session_id) {
      return apiError("Unauthorized.", 401, undefined, cacheHeaders);
    }

    const { data: session } = await admin
      .from("table_sessions")
      .select("session_token")
      .eq("id", orderBase.session_id)
      .single();

    if (
      !session ||
      (session as { session_token: string }).session_token !== sessionToken
    ) {
      return apiError("Unauthorized.", 401, undefined, cacheHeaders);
    }

    return apiSuccess(orderBase, 200, cacheHeaders);
  }
);

const statusSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "delivered", "rejected"]),
  rejectionReason: zOrderNotesOptional(),
});

type StaffAccess = {
  order: {
    id: string;
    location_id: string;
    status: string;
    payment_status: string;
    payment_method: string;
    stripe_payment_intent_id: string | null;
    total: number;
    created_at: string;
  };
  staff: {
    id: string;
    org_id: string;
    location_id: string | null;
    role: string;
  };
};

async function verifyStaffOrderAccess(
  orderId: string
): Promise<StaffAccess | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, location_id, status, payment_status, payment_method, stripe_payment_intent_id, total, created_at"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const orderRow = order as StaffAccess["order"];

  const { data: staff } = await supabase
    .from("staff")
    .select("id, org_id, location_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) return null;

  const staffRow = staff as StaffAccess["staff"];

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location) return null;

  if ((location as { org_id: string }).org_id !== staffRow.org_id) {
    return null;
  }

  if (
    staffRow.location_id &&
    staffRow.location_id !== orderRow.location_id
  ) {
    return null;
  }

  return { order: orderRow, staff: staffRow };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["preparing", "rejected"],
  preparing: ["ready", "rejected"],
  ready: ["delivered", "rejected"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export const PATCH = withErrorHandler(
  "orders-orderId-patch",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "orders");
    if (limited) return limited;

    const { orderId } = await ctx.params;

    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400);
    }

    const access = await verifyStaffOrderAccess(orderId);

    if (!access) {
      return apiError("Unauthorized.", 401);
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid status.", 400);
    }

    const { status, rejectionReason } = parsed.data;

    const allowedNext = VALID_TRANSITIONS[access.order.status] ?? [];
    if (!allowedNext.includes(status)) {
      return apiError(
        `Cannot change from '${access.order.status}' to '${status}'.`,
        409
      );
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const updates: Partial<{
      status: string;
      accepted_at: string;
      preparing_at: string;
      ready_at: string;
      delivered_at: string;
      rejection_reason: string | null;
      payment_status: string;
    }> = { status };

    if (status === "accepted") updates.accepted_at = now;
    if (status === "preparing") updates.preparing_at = now;
    if (status === "ready") updates.ready_at = now;
    if (status === "delivered") updates.delivered_at = now;

    if (
      status === "delivered" &&
      access.order.payment_status === "pending" &&
      access.order.payment_method !== "online" &&
      access.order.payment_method !== "unset"
    ) {
      updates.payment_status = "paid";
    }

    if (status === "rejected") {
      updates.rejection_reason = rejectionReason ?? null;

      if (
        access.order.payment_status === "paid" &&
        access.order.stripe_payment_intent_id
      ) {
        const refundResult = await processRefund(
          access.order,
          access.staff.id,
          rejectionReason ?? "Order rejected by staff"
        );

        if ("error" in refundResult) {
          return apiError(refundResult.error, 400);
        }
      }
    }

    const { error } = await admin
      .from("orders")
      .update(updates as never)
      .eq("id", orderId);

    if (error) {
      return apiError(error.message, 500);
    }

    if (status === "delivered") {
      void enqueue("/api/jobs/send-receipt", { orderId }).catch((err) =>
        logger.error("Receipt enqueue failed", {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    return apiSuccess({ ok: true });
  }
);
