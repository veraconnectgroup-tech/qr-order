import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { GuestIntent } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { OrderFact, SessionPhase } from "@/lib/denis/loop/types";

export function deriveIntent(input: {
  phase: SessionPhase;
  flowNodeId: FlowNodeId;
  orders: OrderFact[];
  cartLineCount: number;
  browse: GuestBrowseProfile;
  conversation: ConversationModel;
  billSettled: boolean;
}): GuestIntent {
  const { phase, flowNodeId, orders, cartLineCount, browse, conversation, billSettled } =
    input;

  if (billSettled || phase === "closed") return "paying";
  if (phase === "settling") return "finishing";

  const deliveredCount = orders.filter((order) => order.status === "delivered").length;
  if (phase === "waiting") return "waiting_food";
  if (deliveredCount > 0 && phase !== "ordering" && phase !== "browsing") {
    return deliveredCount === orders.length ? "eating" : "waiting_food";
  }

  if (
    flowNodeId === "recap" ||
    flowNodeId === "submit" ||
    flowNodeId === "collect" ||
    (cartLineCount > 0 && phase === "ordering")
  ) {
    return "ordering";
  }

  if (cartLineCount > 0 && orders.length === 0) return "decided";

  const comparedProducts =
    browse.viewedProducts.filter((product) => product.viewCount >= 2).length +
    browse.cartAbandoned.length;
  if (comparedProducts >= 1) return "comparing";

  if (
    browse.eventCount > 0 ||
    browse.browsedFood ||
    browse.browsedDrinks ||
    browse.browsedDesserts
  ) {
    return "exploring";
  }

  if (conversation.thread.guestTurns === 0 && phase === "latent") return "arrived";
  if (phase === "browsing") return "exploring";

  return "exploring";
}
