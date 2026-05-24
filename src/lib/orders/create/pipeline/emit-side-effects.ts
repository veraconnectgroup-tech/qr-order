import type {
  CreateOrderSuccess,
  OrderDraft,
} from "@/lib/orders/create/types";
import { logger } from "@/lib/logger";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

async function consumePromoCode(admin: AdminClient, promoCodeId: string) {
  const { data, error } = await admin.rpc("increment_promo_used_count", {
    p_promo_id: promoCodeId,
  });

  if (error || !data) {
    logger.warn("Promo code usage increment failed", {
      promoCodeId,
      error: error?.message,
    });
  }
}

export async function emitOrderSideEffects(
  admin: AdminClient,
  draft: OrderDraft,
  result: CreateOrderSuccess
): Promise<void> {
  const phase =
    draft.mode.kind === "approval" ? "approval_requested" : "created";

  await persistOrderSideEffects(admin, {
    orderId: result.orderId,
    locationId: draft.context.table.location_id,
    orgId: draft.context.org.id,
    orderNumber: result.orderNumber,
    tableName: draft.context.table.name,
    total: result.total,
    paymentStatus: "pending",
    guestEmail: draft.input.guestEmail,
    orderSource: "qr",
    phase,
  });

  if (draft.mode.kind !== "approval" && draft.pricing.promoCodeId) {
    await consumePromoCode(admin, draft.pricing.promoCodeId);
  }

  if (draft.input.guestEmail && draft.mode.kind === "normal") {
    await admin
      .from("table_sessions")
      .update({ guest_email: draft.input.guestEmail })
      .eq("id", draft.mode.sessionId);
  }
}
