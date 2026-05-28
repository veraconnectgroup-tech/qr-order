import type {
  CreateOrderSuccess,
  OrderDraft,
} from "@/lib/orders/create/types";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
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
  }
}
