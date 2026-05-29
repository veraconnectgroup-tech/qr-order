import type { PersistOrderSideEffectsInput } from "@/lib/outbox/persist-order-side-effects";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import { scheduleDenisWorldSignal } from "@/lib/outbox/enqueue-denis-world-signal";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type EmitStaffOrderSideEffectsInput = {
  sideEffects: PersistOrderSideEffectsInput;
  sessionId: string;
};

/** Deferred staff order side effects — outbox first, then Denis (after server commit). */
export async function emitStaffOrderSideEffects(
  admin: AdminClient,
  input: EmitStaffOrderSideEffectsInput
): Promise<void> {
  await persistOrderSideEffects(admin, input.sideEffects);

  scheduleDenisWorldSignal({
    signal: "commerce.order_created",
    orderId: input.sideEffects.orderId,
    sessionId: input.sessionId,
    status: "pending",
  });
}
