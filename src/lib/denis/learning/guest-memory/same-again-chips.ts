import { buildSameAgainChipLabel } from "@/lib/denis/platform/returning-guest";

/** T0 chips for return-guest welcome + drink-empty reorder nudge (M17 / S11). */
export function sameAgainQuickReplyLabels(
  language: string,
  topItem?: string | null
): {
  sameAgain: string;
  somethingElse: string;
} {
  const lang = language.toLowerCase().slice(0, 2);
  const sameAgain = buildSameAgainChipLabel(language, topItem);
  if (lang === "de") {
    return { sameAgain, somethingElse: "Etwas anderes" };
  }
  if (lang === "en") {
    return { sameAgain, somethingElse: "Something else" };
  }
  return { sameAgain, somethingElse: "Nešto drugo" };
}
