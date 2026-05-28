import type { SupabaseClient } from "@supabase/supabase-js";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { projectTableSessionView } from "@/lib/denis/loop/project-view";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import { tableSessionViewToScene } from "@/lib/denis/loop/view-to-scene";
import { composeScene } from "@/lib/scene/compose-scene";
import { deriveGuestSituation } from "@/lib/scene/derive-guest-situation";
import { loadComposeSceneInput } from "@/lib/scene/load-scene-input";
import { loadGuestSceneBySessionId } from "@/lib/scene/refresh-guest-scene";
import type { Scene } from "@/lib/scene/types";

export type LoadedTableSessionView = {
  view: TableSessionView;
  scene: Scene;
};

export async function loadTableSessionView(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    tableId: string;
    locationId: string;
    tableToken: string;
    venueName: string;
  }
): Promise<LoadedTableSessionView | null> {
  const [persistedScene, composeInput] = await Promise.all([
    loadGuestSceneBySessionId(admin, input.sessionId),
    loadComposeSceneInput(admin, input.sessionId),
  ]);

  if (!composeInput) return null;

  const denisActive = composeInput.denisActive;
  const sceneVersion = persistedScene?.version ?? 1;

  const fold = await foldTableSessionState(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.tableToken,
    tableSessionId: input.sessionId,
  });

  const situation = deriveGuestSituation(
    fold.state.commerce.orders.map((order) => ({
      id: order.id,
      order_number: order.orderNumber,
      status: order.status,
      payment_status: order.paymentStatus,
      estimated_prep_minutes: order.estimatedPrepMinutes,
      order_items: order.items.map((item) => ({
        product_name: item.productName,
        quantity: item.quantity,
      })),
    }))
  );

  const scene =
    persistedScene ??
    composeScene(
      {
        ...composeInput,
        situation,
      },
      sceneVersion
    );

  const view = projectTableSessionView(fold.state, null, {
    version: scene.version,
    sessionId: input.sessionId,
    venueName: input.venueName,
    denisActive,
    headline: situation?.headline ?? viewPhaseHeadline(fold.meta.phase),
    phase: fold.meta.phase,
    markState: scene.chrome.markState,
    layers: scene.layers,
  });

  return {
    view,
    scene: tableSessionViewToScene(view, scene),
  };
}

function viewPhaseHeadline(phase: string): string {
  return phase;
}
