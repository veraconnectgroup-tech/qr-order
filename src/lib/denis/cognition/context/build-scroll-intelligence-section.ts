import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";

/** Situation pack SCROLL block from folded browse profile. */
export function buildScrollIntelligenceSection(
  browse: GuestBrowseProfile | null | undefined
): string {
  if (!browse?.scrollIntents?.length) return "";

  const latest = browse.scrollIntents[browse.scrollIntents.length - 1];
  const lines = [
    "SCROLL:",
    `- latest_intent: ${latest.intent}`,
  ];

  if (latest.categoryLabel) {
    lines.push(`- focused_category: ${latest.categoryLabel}`);
  }

  lines.push(`- scroll_signals: ${browse.scrollIntents.length}`);

  if (latest.intent === "fast_search") {
    lines.push("- guest posture: actively searching menu");
  } else if (latest.intent === "slow_category") {
    lines.push("- guest posture: interested in category");
  } else if (latest.intent === "reached_bottom") {
    lines.push("- guest posture: viewed full menu");
  }

  return lines.join("\n");
}
