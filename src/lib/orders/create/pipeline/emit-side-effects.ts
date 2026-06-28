import type {
  CreateOrderSuccess,
  OrderDraft,
} from "@/lib/orders/create/types";
import { applyOrderInventoryDecrement } from "@/lib/denis/intelligence/apply-order-inventory";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
import { scheduleOrderSceneRefresh } from "@/lib/scene/schedule-order-scene-refresh";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

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

  if (draft.input.guestEmail && draft.mode.kind === "normal") {
    await admin
      .from("table_sessions")
      .update({ guest_email: draft.input.guestEmail })
      .eq("id", draft.mode.sessionId);
  }

  if (draft.mode.kind === "normal" || draft.mode.kind === "demo") {
    scheduleDenisWorldSignal({
      signal: "commerce.order_created",
      orderId: result.orderId,
      sessionId: draft.mode.sessionId,
      status: "pending",
    });

    void scheduleOrderSceneRefresh(admin, {
      sessionId: draft.mode.sessionId,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      placed: true,
    }).catch(() => undefined);

    if (draft.mode.kind === "normal") {
      void applyOrderInventoryDecrement(admin, {
        locationId: draft.context.table.location_id,
        orgId: draft.context.org.id,
        lines: draft.lineItems.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
        })),
      }).catch(() => undefined);
    }
  }
}
