import type { AllergenId } from "@/lib/allergens";

export type AiSheetAllergyId =
  | "glutenfrei"
  | "laktosefrei"
  | "vegan"
  | "vegetarisch"
  | "nussallergie"
  | "keine";

export type AiSheetMoodId = "leicht" | "herzhaft" | "schnell" | "ueberraschung";

export const AI_SHEET_ALLERGY_OPTIONS: Array<{
  id: AiSheetAllergyId;
  label: string;
  apiLabel: string;
  allergenIds: AllergenId[];
  exclusive?: boolean;
}> = [
  {
    id: "glutenfrei",
    label: "Glutenfrei",
    apiLabel: "Glutenfrei",
    allergenIds: ["gluten"],
  },
  {
    id: "laktosefrei",
    label: "Laktosefrei",
    apiLabel: "Laktosefrei",
    allergenIds: ["milk"],
  },
  {
    id: "vegan",
    label: "Vegan",
    apiLabel: "Vegan",
    allergenIds: [],
  },
  {
    id: "vegetarisch",
    label: "Vegetarisch",
    apiLabel: "Vegetarisch",
    allergenIds: [],
  },
  {
    id: "nussallergie",
    label: "Nussallergie",
    apiLabel: "Nussallergie",
    allergenIds: ["nuts", "peanuts"],
  },
  {
    id: "keine",
    label: "Keine",
    apiLabel: "Keine",
    allergenIds: [],
    exclusive: true,
  },
];

export const AI_SHEET_MOOD_OPTIONS: Array<{
  id: AiSheetMoodId;
  label: string;
  apiLabel: string;
}> = [
  { id: "leicht", label: "Leicht", apiLabel: "Leicht" },
  { id: "herzhaft", label: "Herzhaft", apiLabel: "Herzhaft" },
  { id: "schnell", label: "Schnell", apiLabel: "Schnell" },
  { id: "ueberraschung", label: "Überraschung", apiLabel: "Überraschung" },
];

export type AiSheetSelections = {
  allergies: AiSheetAllergyId[];
  mood: AiSheetMoodId | null;
};

export function allergenIdsFromSheetSelections(
  selections: AiSheetAllergyId[]
): AllergenId[] {
  if (selections.includes("keine")) return [];

  const ids = new Set<AllergenId>();
  for (const id of selections) {
    const option = AI_SHEET_ALLERGY_OPTIONS.find((o) => o.id === id);
    option?.allergenIds.forEach((allergenId) => ids.add(allergenId));
  }
  return [...ids];
}

export function apiPreferencesFromSheet(selections: AiSheetSelections) {
  const allergyLabels = selections.allergies.includes("keine")
    ? []
    : selections.allergies
        .map(
          (id) =>
            AI_SHEET_ALLERGY_OPTIONS.find((o) => o.id === id)?.apiLabel ?? id
        )
        .filter(Boolean);

  const moodLabel =
    selections.mood != null
      ? AI_SHEET_MOOD_OPTIONS.find((o) => o.id === selections.mood)?.apiLabel ??
        selections.mood
      : "";

  return {
    allergies: allergyLabels,
    mood: moodLabel,
  };
}

export function buildSmartMenuPrompt(selections: AiSheetSelections) {
  const prefs = apiPreferencesFromSheet(selections);
  const parts: string[] = [];

  if (prefs.allergies.length) {
    parts.push(`Allergien/Präferenzen: ${prefs.allergies.join(", ")}.`);
  } else {
    parts.push("Keine Allergien.");
  }

  if (prefs.mood) {
    parts.push(`Stimmung: ${prefs.mood}.`);
  }

  parts.push("Empfehle 2-3 passende Gerichte aus dem Menü.");
  return parts.join(" ");
}

export function buildDrinkPairingPrompt(dishName: string) {
  return `Gast bestellt: ${dishName}. Empfehle EIN Getraenk.`;
}
