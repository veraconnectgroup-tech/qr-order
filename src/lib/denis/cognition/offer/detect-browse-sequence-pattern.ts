import type {
  BrowseSequenceEntry,
  BrowseSequencePattern,
} from "@/lib/denis/cognition/offer/offer-types";

const SECTION_ORDER = ["drinks", "food", "desserts"] as const;

export function detectBrowseSequencePattern(
  sequence: BrowseSequenceEntry[]
): BrowseSequencePattern {
  if (sequence.length === 0) return "unknown";

  const sections = sequence
    .map((entry) => entry.menuSection)
    .filter((section): section is "food" | "drinks" | "desserts" => section != null);

  const dessertIdx = sections.indexOf("desserts");
  const foodAfterDessert =
    dessertIdx >= 0 && sections.slice(dessertIdx + 1).includes("food");
  if (foodAfterDessert) return "price_sensitive";

  const viewCounts = new Map<string, number>();
  for (const entry of sequence) {
    if (entry.action !== "view_product" || !entry.productId) continue;
    viewCounts.set(entry.productId, (viewCounts.get(entry.productId) ?? 0) + 1);
  }
  if ([...viewCounts.values()].some((count) => count >= 2)) return "return_view";

  const uniqueCategories = new Set(
    sequence.map((entry) => entry.categoryId).filter(Boolean)
  );
  const maxDwell = Math.max(...sequence.map((entry) => entry.dwellMs ?? 0), 0);
  if (uniqueCategories.size <= 2 && maxDwell >= 30_000) return "decisive";

  if (uniqueCategories.size >= 4) return "explorer";

  const orderedSections = sections.filter(
    (section, index, arr) => arr.indexOf(section) === index
  );
  const isMonotonic = orderedSections.every((section, index) => {
    if (index === 0) return true;
    const prev = orderedSections[index - 1]!;
    return (
      SECTION_ORDER.indexOf(section) >= SECTION_ORDER.indexOf(prev)
    );
  });
  if (isMonotonic && orderedSections.length >= 2) return "normal_flow";

  return "unknown";
}
