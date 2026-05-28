import type { TableSessionView } from "@/lib/denis/loop/view-types";
import { deriveGuestSituation } from "@/lib/scene/derive-guest-situation";
import type { Scene, SceneSituation } from "@/lib/scene/types";

function situationFromView(view: TableSessionView): SceneSituation | null {
  const activeOrders = view.orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );

  if (!activeOrders.length && !view.orders.length) return null;

  return deriveGuestSituation(
    view.orders.map((order) => ({
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
}

/** Bridge TableSessionView → legacy Scene for dock/chat renderers (Phase B). */
export function tableSessionViewToScene(
  view: TableSessionView,
  fallback?: Scene | null
): Scene {
  const situation = situationFromView(view);

  return {
    version: view.version,
    sessionId: view.sessionId,
    phase: view.phase,
    chrome: {
      tableName: view.chrome.tableName,
      venueName: view.chrome.venueName,
      markState: view.chrome.markState,
      denisActive: view.chrome.denisActive,
      situation: situation
        ? {
            ...situation,
            headline: view.chrome.headline,
          }
        : view.chrome.headline
          ? {
              headline: view.chrome.headline,
              orders: [],
              hasReadyOrder: false,
              hasActiveKitchen: false,
            }
          : (fallback?.chrome.situation ?? null),
    },
    layers: view.layers.length ? view.layers : (fallback?.layers ?? []),
  };
}
