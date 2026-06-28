import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { ScrollIntentKind } from "@/lib/guest/scroll-intelligence";
import { scrollSignalToNudgeKind } from "@/lib/guest/scroll-intelligence";

export type ScrollInterestTrigger = {
  kind: ReturnType<typeof scrollSignalToNudgeKind>;
  intent: ScrollIntentKind;
  categoryLabel?: string;
  message: string;
};

const SCROLL_MESSAGES: Record<ScrollIntentKind, string> = {
  fast_search: "Tražite nešto? Mogu pomoći!",
  slow_category: "Naši burgeri su hit danas!",
  reached_bottom: "Nešto vas zanima? Pitajte me!",
};

/** Proactive scroll_interest trigger from folded browse profile (server-side). */
export function detectScrollInterestTrigger(input: {
  browse: GuestBrowseProfile;
  dismissedKeys?: string[];
}): ScrollInterestTrigger | null {
  const dismissed = new Set(input.dismissedKeys ?? []);
  const latest = input.browse.scrollIntents?.[input.browse.scrollIntents.length - 1];
  if (!latest) return null;

  const kind = scrollSignalToNudgeKind(latest.intent);
  if (dismissed.has(kind) || dismissed.has("scroll_interest")) return null;

  const categoryLabel = latest.categoryLabel;
  let message = SCROLL_MESSAGES[latest.intent];
  if (latest.intent === "slow_category" && categoryLabel) {
    message = message.replace(/burgeri/gi, categoryLabel);
  }

  return {
    kind,
    intent: latest.intent,
    categoryLabel,
    message,
  };
}
