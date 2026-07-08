import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { recordSensitiveAction } from "@/lib/audit/record-sensitive-action";
import { apiError, apiSuccess } from "@/lib/api-response";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { evaluatePriceOverride } from "@/lib/loss-prevention/evaluate-price-override";
import { recalculateOrderTotalsFromItems } from "@/lib/orders/recalculate-order-totals";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/tax/vat";

const patchSchema = z.object({
  unitPrice: z.number().positive().max(10_000),
  reason: z.string().trim().min(3).max(500),
});

type StaffAccess = {
  order: {
    id: string;
    location_id: string;
    session_id: string | null;
    status: string;
    payment_status: string;
    discount_amount: number;
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
      "id, location_id, session_id, status, payment_status, discount_amount"
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

export const PATCH = withErrorHandler(
  "orders-orderItem-price-patch",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { orderId, itemId } = await ctx.params;

    if (!isUuid(orderId) || !isUuid(itemId)) {
      return apiError("Invalid order or item id.", 400);
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

    const { unitPrice, reason } = parsed.data;
    const guard = evaluatePriceOverride({
      orderStatus: access.order.status,
      paymentStatus: access.order.payment_status,
      reason,
      actorRole: access.staff.role,
      unitPrice,
    });

    if (!guard.allowed) {
      return apiError(guard.error, guard.status);
    }

    const admin = createAdminClient();

    const { data: item } = await admin
      .from("order_items")
      .select("id, order_id, product_name, quantity, unit_price, total, tax_rate")
      .eq("id", itemId)
      .eq("order_id", orderId)
      .maybeSingle();

    if (!item) {
      return apiError("Order item not found.", 404);
    }

    const itemRow = item as {
      id: string;
      order_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total: number;
      tax_rate: number;
    };

    const priceBefore = Number(itemRow.unit_price);
    const newLineTotal = roundMoney(unitPrice * itemRow.quantity);

    const { error: itemError } = await admin
      .from("order_items")
      .update({
        unit_price: unitPrice,
        total: newLineTotal,
      } as never)
      .eq("id", itemId);

    if (itemError) {
      return apiError(itemError.message, 500);
    }

    const { data: allItems } = await admin
      .from("order_items")
      .select("total, tax_rate")
      .eq("order_id", orderId);

    const totals = recalculateOrderTotalsFromItems(
      (allItems ?? []) as Array<{ total: number; tax_rate: number }>,
      Number(access.order.discount_amount ?? 0)
    );

    const { error: orderError } = await admin
      .from("orders")
      .update({
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        tax_percent: totals.tax_percent,
        total: totals.total,
      } as never)
      .eq("id", orderId);

    if (orderError) {
      return apiError(orderError.message, 500);
    }

    await auditLog({
      orgId: access.staff.org_id,
      userId: access.staff.user_id,
      action: "update",
      entityType: "order_item",
      entityId: itemId,
      oldValue: {
        unit_price: priceBefore,
        total: itemRow.total,
      },
      newValue: {
        unit_price: unitPrice,
        total: newLineTotal,
        reason,
      },
      request: req,
    });

    await recordSensitiveAction(admin, {
      orderId,
      sessionId: access.order.session_id,
      action: "price_override",
      targetType: "order_item",
      targetId: itemId,
      actorStaffId: access.staff.id,
      reason,
      approvedByStaffId: guard.requiresManager ? access.staff.id : null,
      riskFlag: true,
      context: {
        product_name: itemRow.product_name,
        quantity: itemRow.quantity,
        price_before: priceBefore,
        price_after: unitPrice,
        line_total_before: itemRow.total,
        line_total_after: newLineTotal,
        order_total_after: totals.total,
      },
      idempotencyKey: `price_override:${itemId}:${unitPrice}:${priceBefore}`,
    });

    return apiSuccess({
      ok: true,
      itemId,
      unitPrice,
      lineTotal: newLineTotal,
      orderTotal: totals.total,
    });
  }
);
