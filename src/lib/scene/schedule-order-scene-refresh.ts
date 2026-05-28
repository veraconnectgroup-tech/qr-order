import type { createAdminClient } from "@/lib/supabase/admin";
import { scheduleGuestSceneRefresh } from "./enqueue-scene-refresh";
import type { SceneRefreshOverrides } from "./map-turn-to-scene-overrides";

type AdminClient = ReturnType<typeof createAdminClient>;

/** SC-8 — refresh guest scene after order lifecycle events. */
export async function scheduleOrderSceneRefresh(
  admin: AdminClient,
  input: {
    sessionId: string;
    orderId?: string;
    orderNumber?: number;
    /** When true, show "order received" banner with view_order action. */
    placed?: boolean;
  }
): Promise<void> {
  const overrides: SceneRefreshOverrides = { sessionId: input.sessionId };

  if (input.placed && input.orderId && input.orderNumber != null) {
    overrides.proactiveBanner = {
      id: `order-placed-${input.orderId}`,
      message: `#${input.orderNumber}`,
      action: "view_order",
      orderId: input.orderId,
    };
  }

  await scheduleGuestSceneRefresh(admin, overrides);
}
