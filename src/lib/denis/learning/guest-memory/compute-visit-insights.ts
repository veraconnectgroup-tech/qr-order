import type {
  GuestMemoryProjection,
  GuestMemoryVisitItem,
  PreferredMealPattern,
} from "@/lib/denis/platform/guest-memory-types";

const MAX_MODIFIER_PREFS = 8;

function normalizeModifier(label: string): string {
  return label.trim().toLowerCase();
}

/** Extract unique modifier labels from delivered order items. */
export function extractModifierPreferences(
  items: GuestMemoryVisitItem[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    for (const raw of item.modifiers ?? []) {
      const label = normalizeModifier(raw);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(raw.trim());
    }
  }

  return out.slice(0, MAX_MODIFIER_PREFS);
}

/** Merge recurring modifier prefs — new visit modifiers appended, deduped, capped. */
export function mergeModifierPreferences(
  existing: string[],
  fromVisit: string[]
): string[] {
  const merged = [...existing];
  const seen = new Set(existing.map(normalizeModifier));

  for (const label of fromVisit) {
    const key = normalizeModifier(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(label.trim());
  }

  return merged.slice(0, MAX_MODIFIER_PREFS);
}

export function computeRunningAverage(
  current: number | null,
  newValue: number,
  priorVisitCount: number
): number {
  if (priorVisitCount <= 0 || current == null) return Math.round(newValue);
  const total = current * priorVisitCount + newValue;
  return Math.round(total / (priorVisitCount + 1));
}

function sectionFlags(items: GuestMemoryVisitItem[]): {
  drinks: boolean;
  food: boolean;
  desserts: boolean;
} {
  let drinks = false;
  let food = false;
  let desserts = false;

  for (const item of items) {
    const section = item.menuSection?.toLowerCase() ?? "food";
    if (section === "drinks") drinks = true;
    else if (section === "desserts") desserts = true;
    else food = true;
  }

  return { drinks, food, desserts };
}

/** Detect meal pattern from order item menu sections. */
export function detectMealPattern(
  items: GuestMemoryVisitItem[]
): PreferredMealPattern | null {
  if (items.length === 0) return null;

  const { drinks, food, desserts } = sectionFlags(items);

  if (drinks && !food && !desserts) return "drinks_only";
  if (food && !drinks && !desserts) return "main_only";
  if (food && drinks && desserts) return "starter_main_dessert";
  if (food && drinks && !desserts) return "main_drinks";
  if (food && desserts && !drinks) return "main_dessert";
  if (food) return "main_only";
  if (drinks) return "drinks_only";

  return null;
}

export type VisitMemoryPatch = {
  lastVisitItemNames: string[];
  modifierPreferences: string[];
  avgSpendCents: number | null;
  avgSessionMinutes: number | null;
  preferredMealPattern: PreferredMealPattern | null;
};

/** Compute memory fields to persist after a delivered visit (consent required upstream). */
export function computeVisitMemoryPatch(input: {
  memory: Pick<
    GuestMemoryProjection,
    | "visitCount"
    | "modifierPreferences"
    | "avgSpendCents"
    | "avgSessionMinutes"
    | "preferredMealPattern"
  >;
  itemNames: string[];
  items: GuestMemoryVisitItem[];
  spendCents?: number;
  sessionMinutes?: number;
}): VisitMemoryPatch {
  const visitItems =
    input.items.length > 0
      ? input.items
      : input.itemNames.map((productName) => ({ productName }));

  const visitModifiers = extractModifierPreferences(visitItems);
  const priorVisits = input.memory.visitCount ?? 0;
  const modifierPreferences = input.memory.modifierPreferences ?? [];
  const avgSpendCents = input.memory.avgSpendCents ?? null;
  const avgSessionMinutes = input.memory.avgSessionMinutes ?? null;
  const preferredMealPattern = input.memory.preferredMealPattern ?? null;

  return {
    lastVisitItemNames: [...new Set(input.itemNames.filter(Boolean))].slice(0, 8),
    modifierPreferences: mergeModifierPreferences(
      modifierPreferences,
      visitModifiers
    ),
    avgSpendCents:
      input.spendCents != null && input.spendCents > 0
        ? computeRunningAverage(
            avgSpendCents,
            input.spendCents,
            priorVisits
          )
        : avgSpendCents,
    avgSessionMinutes:
      input.sessionMinutes != null && input.sessionMinutes > 0
        ? computeRunningAverage(
            avgSessionMinutes,
            input.sessionMinutes,
            priorVisits
          )
        : avgSessionMinutes,
    preferredMealPattern:
      detectMealPattern(visitItems) ?? preferredMealPattern,
  };
}
