
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { recordSensitiveAction } from "@/lib/audit/record-sensitive-action";
import { evaluateVoidLadder } from "@/lib/loss-prevention/evaluate-void-ladder";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { executeOrderSaga } from "@/lib/orders/order-saga";
import { withRateLimit, withStaffRateLimit } from "@/lib/rate-limit";
import { getCurrentTraceId } from "@/lib/resilience/trace.server";
import { isUuid } from "@/lib/security/sanitize";
import { zOrderNotesOptional, zSessionToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGuestOrderDetailRow } from "@/lib/supabase/parse-order-rows";
import { createServerClient } from "@/lib/supabase/server";
import { processRefund } from "@/lib/stripe/refund";
import { performStorno } from "@/lib/fiscal/storno";
import { abortPendingFiscalSale } from "@/lib/fiscal/runtime/fiscal-abort";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { isPaymentMethodAllowed } from "@/lib/orders/shared/payment-method";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
import { runCommerceExperience } from "@/lib/commerce/runtime/run-commerce-experience";
import type { PaymentMethod } from "@/lib/constants";

function parseSessionToken(value: string | null) {
  return zSessionToken().safeParse(value ?? "");
}

export const GET = withErrorHandler(
  "orders-orderId-get",
  async (req, ctx) => {
    const cacheHeaders = noCache();
    const limited = await withRateLimit(req, "orders-guest");
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

    const orderBase = parseGuestOrderDetailRow(order);

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
  status: z.enum([
    "accepted",
    "preparing",
    "ready",
    "delivered",
    "rejected",
    "cancelled",
  ]),
  rejectionReason: zOrderNotesOptional(),
});

const paymentMethodSchema = z.object({
  payment_method: z.enum([
    "online",
    "at_bar",
    "card_at_table",
    "card_terminal",
  ]),
});

const patchSchema = z
  .object({
    status: statusSchema.shape.status.optional(),
    rejectionReason: statusSchema.shape.rejectionReason,
    payment_method: paymentMethodSchema.shape.payment_method.optional(),
  })
  .refine((body) => body.status !== undefined || body.payment_method !== undefined, {
    message: "No updates.",
  });

type StaffAccess = {
  order: {
    id: string;
    location_id: string;
    session_id: string | null;
    status: string;
    order_number: number;
    payment_status: string;
    payment_method: string;
    stripe_payment_intent_id: string | null;
    total: number;
    tip_amount: number | null;
    created_at: string;
    tse_signature: string | null;
  };
  staff: {
    id: string;
    user_id: string;
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
      "id, location_id, session_id, status, order_number, payment_status, payment_method, stripe_payment_intent_id, total, tip_amount, created_at, tse_signature"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const orderRow = order as StaffAccess["order"];

  const { data: staff } = await supabase
    .from("staff")
    .select("id, user_id, org_id, location_id, role")
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
  accepted: ["preparing", "rejected", "cancelled"],
  preparing: ["ready", "rejected", "cancelled"],
  ready: ["delivered", "rejected", "cancelled"],
  delivered: ["cancelled"],
  rejected: [],
  cancelled: [],
};

export const PATCH = withErrorHandler(
  "orders-orderId-patch",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
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

    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid request body.", 400);
    }

    const { status, rejectionReason, payment_method: paymentMethod } =
      parsed.data;

    const admin = createAdminClient();

    if (paymentMethod !== undefined) {
      if (access.order.payment_status === "paid") {
        return apiError("Cannot change payment method on a paid order.", 409);
      }

      if (
        access.order.status === "cancelled" ||
        access.order.status === "rejected"
      ) {
        return apiError(
          "Cannot change payment method on a cancelled order.",
          409
        );
      }

      if (access.order.payment_method === paymentMethod) {
        return apiSuccess({ ok: true });
      }

      const [{ data: location }, { data: org }] = await Promise.all([
        admin
          .from("locations")
          .select(
            "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
          )
          .eq("id", access.order.location_id)
          .single(),
        admin
          .from("organizations")
          .select("stripe_onboarded")
          .eq("id", access.staff.org_id)
          .single(),
      ]);

      if (!location || !org) {
        return apiError("Location not found.", 404);
      }

      const locationRow = location as {
        payment_online_enabled: boolean;
        payment_at_bar_enabled: boolean;
        payment_card_at_table_enabled: boolean;
      };
      const orgRow = org as { stripe_onboarded: boolean };

      if (
        !isPaymentMethodAllowed(
          paymentMethod as PaymentMethod,
          locationRow,
          orgRow
        )
      ) {
        return apiError("Payment method not enabled for this location.", 400);
      }

      const { error: paymentError } = await admin
        .from("orders")
        .update({ payment_method: paymentMethod } as never)
        .eq("id", orderId);

      if (paymentError) {
        return apiError(paymentError.message, 500);
      }

      await auditLog({
        orgId: access.staff.org_id,
        userId: access.staff.user_id,
        action: "update",
        entityType: "order",
        entityId: orderId,
        oldValue: { payment_method: access.order.payment_method },
        newValue: { payment_method: paymentMethod },
        request: req,
      });

      if (status === undefined) {
        return apiSuccess({ ok: true });
      }
    }

    if (status === undefined) {
      return apiSuccess({ ok: true });
    }

    const parsedStatus = statusSchema.safeParse({ status, rejectionReason });
    if (!parsedStatus.success) {
      return apiError("Invalid status.", 400);
    }

    if (access.order.status === status) {
      return apiSuccess({ ok: true });
    }

    const allowedNext = VALID_TRANSITIONS[access.order.status] ?? [];
    if (!allowedNext.includes(status)) {
      return apiError(
        `Cannot change from '${access.order.status}' to '${status}'.`,
        409
      );
    }

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

    const markPaidOnDeliver =
      status === "delivered" &&
      access.order.payment_status === "pending" &&
      access.order.payment_method !== "online" &&
      access.order.payment_method !== "card_terminal" &&
      access.order.payment_method !== "unset";

    let voidLadder:
      | ReturnType<typeof evaluateVoidLadder>
      | null = null;

    if (status === "rejected" || status === "cancelled") {
      const config = await loadConciergeConfigForLocation(
        access.order.location_id
      );
      const voidLadderEnabled =
        config.ops.lossPrevention.enabled &&
        config.ops.lossPrevention.voidLadderEnabled;

      if (voidLadderEnabled) {
        const { data: stationRows } = await admin
          .from("order_station_states")
          .select("station, status")
          .eq("order_id", orderId);

        voidLadder = evaluateVoidLadder({
          orderStatus: access.order.status,
          paymentStatus: access.order.payment_status,
          reason: rejectionReason,
          actorRole: access.staff.role,
          stationStates: (stationRows ?? []) as Array<{
            station: string;
            status: string;
          }>,
        });

        if (!voidLadder.allowed) {
          return apiError(voidLadder.error, voidLadder.status);
        }
      }
    }

    if (status === "rejected") {
      updates.rejection_reason = rejectionReason ?? null;

      if (!access.order.tse_signature) {
        await abortPendingFiscalSale(admin, orderId);
      }

      if (access.order.tse_signature) {
        const stornoResult = await performStorno({
          orderId,
          reason: rejectionReason ?? "Order rejected by staff",
          performedBy: access.staff.id,
        });

        if ("error" in stornoResult) {
          return apiError(stornoResult.error, stornoResult.code);
        }
      } else if (
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

    if (status === "cancelled") {
      if (
        access.order.status === "delivered" &&
        !["owner", "manager"].includes(access.staff.role)
      ) {
        return apiError(
          "Only owner/manager can cancel delivered orders.",
          403
        );
      }

      updates.rejection_reason =
        rejectionReason ?? "Order cancelled by staff";

      if (access.order.tse_signature) {
        const stornoResult = await performStorno({
          orderId,
          reason: rejectionReason ?? "Order cancelled by staff",
          performedBy: access.staff.id,
        });

        if ("error" in stornoResult) {
          logger.warn("Storno on cancel failed", {
            orderId,
            error: stornoResult.error,
          });
        }
      } else if (
        access.order.payment_status === "paid" &&
        access.order.stripe_payment_intent_id
      ) {
        const refundResult = await processRefund(
          access.order,
          access.staff.id,
          rejectionReason ?? "Order cancelled by staff",
          { skipWindowCheck: false }
        );

        if ("error" in refundResult) {
          logger.warn("Refund skipped on cancel", {
            orderId,
            reason: refundResult.error,
          });
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

    await auditLog({
      orgId: access.staff.org_id,
      userId: access.staff.user_id,
      action: "update",
      entityType: "order",
      entityId: orderId,
      oldValue: { status: access.order.status },
      newValue: { status, rejectionReason: rejectionReason ?? null },
      request: req,
    });

    if (markPaidOnDeliver) {
      const traceId = getCurrentTraceId() ?? crypto.randomUUID();
      const tipAmount = Number(access.order.tip_amount ?? 0);
      const amountCents =
        Math.round(Number(access.order.total) * 100) +
        Math.round(tipAmount * 100);

      void executeOrderSaga(orderId, traceId, {
        amountCents,
        tipAmount,
      }).catch((err) =>
        logger.error("Order saga failed on deliver", {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    dispatchOrgWebhook(access.staff.org_id, "order.status_changed", {
      order_id: orderId,
      previous_status: access.order.status,
      status,
    });

    if (status === "rejected" || status === "cancelled") {
      dispatchOrgWebhook(access.staff.org_id, "order.cancelled", {
        order_id: orderId,
        status,
      });

      if (voidLadder?.allowed) {
        await recordSensitiveAction(admin, {
          orderId,
          sessionId: access.order.session_id,
          action: "void",
          targetType: "order",
          targetId: orderId,
          actorStaffId: access.staff.id,
          reason: rejectionReason ?? null,
          approvedByStaffId: voidLadder.requiresManager
            ? access.staff.id
            : null,
          riskFlag:
            voidLadder.phase === "served" && !rejectionReason?.trim(),
          context: {
            voidPhase: voidLadder.phase,
            previousStatus: access.order.status,
            newStatus: status,
          },
        });
      }
    }

    if (access.order.session_id) {
      scheduleDenisWorldSignal({
        signal: "commerce.order_status",
        orderId,
        sessionId: access.order.session_id,
        status,
        previousStatus: access.order.status,
      });
    }

    if (status === "delivered" && access.order.session_id) {
      void runCommerceExperience(
        admin,
        { kind: "order_delivered", orderId },
        {
          traceId: getCurrentTraceId(),
          idempotencyKey: `order_delivered:${orderId}`,
        }
      ).catch((commerceError) => {
        logger.warn("order_delivered commerce experience failed", {
          orderId,
          error:
            commerceError instanceof Error
              ? commerceError.message
              : String(commerceError),
        });
      });
    }

    return apiSuccess({ ok: true });
  }
);
