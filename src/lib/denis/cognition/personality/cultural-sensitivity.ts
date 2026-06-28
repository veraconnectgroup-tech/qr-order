export type CulturalProfile = "de_formal" | "sr_warm" | "en_professional";

export function resolveCulturalProfile(
  language: string,
  _tone?: import("@/lib/denis/config/concierge-config.schema").ConciergeTone
): CulturalProfile {
  const lang = language.slice(0, 2).toLowerCase();
  if (lang === "de") return "de_formal";
  if (lang === "sr" || lang === "hr" || lang === "bs") return "sr_warm";
  return "en_professional";
}

export function buildCulturalSensitivityBlock(profile: CulturalProfile): string {
  switch (profile) {
    case "de_formal":
      return [
        "CULTURAL (DE):",
        "- Siezen always — formal, precise, structured sentences.",
        "- No casual du unless guest explicitly uses du first.",
        "- Be exact with sizes, allergens, and prices.",
      ].join("\n");
    case "sr_warm":
      return [
        "CULTURAL (SR/HR):",
        "- Warm and relaxed — respectful Vi-formal; mirror polite casual only if guest does first.",
        "- Slightly longer, hospitable phrasing is OK.",
        "- Never stiff corporate language — feel like a local konobar.",
      ].join("\n");
    case "en_professional":
      return [
        "CULTURAL (EN):",
        "- Friendly professional — clear, welcoming, no slang overload.",
        "- Direct questions; confirm orders explicitly.",
      ].join("\n");
    default:
      return "";
  }
}
