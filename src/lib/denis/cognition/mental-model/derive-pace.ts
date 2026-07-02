import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestPace,
  GuestScrollPosture,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";

function rapidActionBurst(actionTimestamps: number[]): boolean {
  if (actionTimestamps.length < 3) return false;
  const sorted = [...actionTimestamps].sort((a, b) => a - b);

  let burst = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! <= 20_000) {
      burst++;
      if (burst >= 2) return true;
    } else {
      burst = 0;
    }
  }

  return false;
}

export function derivePace(input: {
  spine: GuestSignalSpine;
  browse: GuestBrowseProfile;
  scrollPosture?: GuestScrollPosture;
}): GuestPace {
  if (input.scrollPosture?.searching) {
    return "rushed";
  }

  if (input.spine.maxProductCartChurn >= 4 || input.browse.cartAbandoned.length >= 2) {
    return "indecisive";
  }

  const avgDwell =
    input.browse.eventCount > 0
      ? input.browse.totalBrowseMs / input.browse.eventCount
      : 0;
  if (input.scrollPosture?.deferUpsell && avgDwell >= 4000) {
    return "relaxed";
  }
  if (avgDwell >= 6000 && input.browse.eventCount >= 2) return "relaxed";

  const lengths = input.spine.guestMessages.map((message) => message.text.length);
  const avgMsgLen =
    lengths.length > 0
      ? lengths.reduce((sum, len) => sum + len, 0) / lengths.length
      : 0;

  if (avgMsgLen > 0 && avgMsgLen <= 12 && rapidActionBurst(input.spine.actionTimestamps)) {
    return "rushed";
  }

  return "normal";
}
