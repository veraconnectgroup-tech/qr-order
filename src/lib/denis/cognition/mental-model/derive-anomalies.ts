import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type {
  GuestAnomaly,
  GuestIntent,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";

const MENU_SILENCE_MS = 15 * 60 * 1000;

function lastGuestInteractionMs(input: {
  spine: GuestSignalSpine;
  browse: GuestBrowseProfile;
}): number {
  const messageAt =
    input.spine.guestMessages[input.spine.guestMessages.length - 1]?.at ?? 0;
  const browseAt = input.browse.viewedProducts.reduce((latest, product) => {
    const at = product.lastViewedAt ? Date.parse(product.lastViewedAt) : 0;
    return Number.isFinite(at) ? Math.max(latest, at) : latest;
  }, 0);
  const actionAt = input.spine.actionTimestamps.at(-1) ?? 0;
  return Math.max(messageAt, browseAt, actionAt);
}

/** Browse / cart anomalies — gentle nudge, help, comparison (Prompt 92). */
export function deriveAnomalies(input: {
  spine: GuestSignalSpine;
  browse: GuestBrowseProfile;
  conversation: ConversationModel;
  intent: GuestIntent;
  cartLineCount: number;
  now: number;
}): GuestAnomaly[] {
  const anomalies: GuestAnomaly[] = [];
  const lastInteractionAt = lastGuestInteractionMs(input);
  const silenceMs =
    lastInteractionAt > 0 ? input.now - lastInteractionAt : 0;

  if (
    silenceMs >= MENU_SILENCE_MS &&
    input.cartLineCount === 0 &&
    (input.intent === "exploring" ||
      input.intent === "comparing" ||
      input.intent === "arrived")
  ) {
    anomalies.push({
      kind: "menu_silence",
      severity: "medium",
      suggestedAction: "gentle_nudge",
      detail: `No interaction for ${Math.round(silenceMs / 60_000)}min`,
    });
  }

  const viewedCount = input.browse.viewedProducts.length;
  const addedToCartCount = input.browse.viewedProducts.filter(
    (product) => product.addedToCart
  ).length;
  const rapidBrowse = input.spine.actionTimestamps.length >= 4;

  if (
    viewedCount >= 3 &&
    addedToCartCount === 0 &&
    input.cartLineCount === 0 &&
    rapidBrowse &&
    (input.intent === "exploring" || input.intent === "comparing")
  ) {
    anomalies.push({
      kind: "browse_no_cart",
      severity: "low",
      suggestedAction: "offer_help",
      detail: "Rapid browsing without cart adds",
    });
  }

  if (input.spine.maxProductCartChurn >= 3) {
    anomalies.push({
      kind: "cart_churn_indecisive",
      severity: "medium",
      suggestedAction: "offer_comparison",
      detail: `Product cart churn ${input.spine.maxProductCartChurn}x`,
    });
  }

  void input.conversation;

  return anomalies;
}
