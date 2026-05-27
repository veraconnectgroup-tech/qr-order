import type { GuestIntent } from "@/lib/denis/platform/timeline-types";

export function mapLegacyIntentToGuest(intent: string): GuestIntent {
  switch (intent) {
    case "order":
      return "ORDER";
    case "confirm":
      return "CONFIRM";
    case "clarify":
      return "CLARIFY_REPLY";
    case "menu_info":
    case "recommend":
      return "BROWSE";
    case "status":
      return "STATUS";
    case "chat":
      return "SMALLTALK";
    default:
      return "UNKNOWN";
  }
}

export function guestIntentTierFromReflex(usedT0: boolean): "T0" | "T2" {
  return usedT0 ? "T0" : "T2";
}

export function resolveTurnIntent(
  reflexIntent: string | undefined,
  legacyIntent: string
): GuestIntent {
  if (reflexIntent && reflexIntent !== "UNKNOWN") {
    return reflexIntent as GuestIntent;
  }
  return mapLegacyIntentToGuest(legacyIntent);
}
