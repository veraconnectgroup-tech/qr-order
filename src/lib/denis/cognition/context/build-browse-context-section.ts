import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { summarizeBrowseCategoryFocus } from "@/lib/denis/cognition/browse/detect-browse-triggers";

/** Situation pack BROWSE CONTEXT block for LLM perceive turns. */
export function buildBrowseContextSection(
  browse: GuestBrowseProfile | null | undefined
): string {
  if (!browse || browse.eventCount === 0) return "";

  const lines = ["BROWSE CONTEXT:"];

  if (browse.sessionStartedAt) {
    lines.push(`- session_started: ${browse.sessionStartedAt}`);
  }
  if (browse.lastBrowseAt) {
    lines.push(`- last_signal: ${browse.lastBrowseAt}`);
  }

  lines.push(`- total_dwell_ms: ${browse.totalBrowseMs}`);
  lines.push(`- products_viewed: ${browse.viewedProducts.length}`);

  const focusLabel = summarizeBrowseCategoryFocus(browse);
  const topFocus = browse.categoryFocus[0];
  if (topFocus) {
    lines.push(
      `- category_focus: ${topFocus.categoryLabel} (${topFocus.uniqueProductCount} items, ${Math.round(topFocus.totalDwellMs / 1000)}s)`
    );
  }

  if (browse.dominantMenuSection) {
    lines.push(`- dominant_section: ${browse.dominantMenuSection}`);
  }

  if (browse.interestedProducts.length) {
    const names = browse.interestedProducts
      .slice(0, 3)
      .map((row) => row.productName)
      .join(", ");
    lines.push(`- interested: ${names}`);
  }

  if (browse.abandonedProducts.length) {
    const names = browse.abandonedProducts
      .slice(0, 2)
      .map((row) => row.productName)
      .join(", ");
    lines.push(`- abandoned: ${names}`);
  }

  const stats = browse.priceBrowseStats;
  if (stats.viewedPriceCount > 0) {
    lines.push(
      `- price_signal: avg €${stats.avgViewedPrice ?? "?"}${stats.onlyBudgetItems ? " (budget browsing)" : ""}${stats.onlyPremiumItems ? " (premium browsing)" : ""}`
    );
  }

  if (browse.topFollowUpProduct && !browse.topFollowUpProduct.productId.startsWith("memory-")) {
    lines.push(
      `- follow_up_candidate: ${browse.topFollowUpProduct.productName} (${browse.topFollowUpProduct.disposition})`
    );
  }

  if (focusLabel && topFocus && topFocus.uniqueProductCount >= 3) {
    lines.push(
      `- posture: comparing ${focusLabel} — offer one confident pick, not a menu dump`
    );
  } else if (browse.browsedDesserts && browse.dominantMenuSection === "desserts") {
    lines.push("- posture: dessert curiosity — one hero pick (e.g. Tiramisu)");
  } else if (stats.onlyBudgetItems) {
    lines.push("- posture: value-first — lead with affordable picks");
  }

  return lines.join("\n");
}
