import type { ConciergeTone } from "@/lib/denis/config/concierge-config.schema";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";

export const GLOBAL_HUMOR_FORBIDDEN = [
  "politics",
  "religion",
  "appearance",
  "weight",
  "nationality",
  "gender",
  "disability",
  "alcohol abuse",
  "drunk",
] as const;

const PLAYFUL_HUMOR_TEMPLATES: Record<
  "sr" | "de" | "en",
  (product: string) => string
> = {
  sr: (product) =>
    `Naš ${product} je toliko dobar da se gosti vraćaju samo zbog njega — i to je statistički dokazano!`,
  de: (product) =>
    `Unser ${product} ist so gut, dass Gäste extra wiederkommen — statistisch belegt!`,
  en: (product) =>
    `Our ${product} is so good guests come back just for it — statistically proven!`,
};

export function isHumorAllowed(
  tone: ConciergeTone,
  mentalModel?: GuestMentalModel | null
): boolean {
  if (tone !== "playful_luxury") return false;
  const frustration = mentalModel?.affect?.frustration.level ?? "none";
  if (frustration !== "none") return false;
  if (mentalModel?.receptiveness === "closed") return false;
  return true;
}

export function buildHumorGuidanceBlock(input: {
  tone: ConciergeTone;
  language: string;
  productName?: string | null;
  forbiddenPhrases: string[];
}): string | null {
  if (input.tone !== "playful_luxury") return null;

  const langKey = input.language.slice(0, 2).toLowerCase();
  const lang =
    langKey === "sr" || langKey === "de" || langKey === "en"
      ? (langKey as "sr" | "de" | "en")
      : "en";

  const product = input.productName?.trim() || "Signature dish";
  const example = PLAYFUL_HUMOR_TEMPLATES[lang](product);

  const forbidden = [
    ...GLOBAL_HUMOR_FORBIDDEN,
    ...input.forbiddenPhrases.map((p) => p.toLowerCase()),
  ];

  return [
    "HUMOR ENGINE (playful_luxury only):",
    "- Light, menu-related wit only — never edgy, political, or personal.",
    "- One gentle joke max per session; skip if guest seems rushed or frustrated.",
    `- Example tone (adapt, do not copy verbatim): "${example}"`,
    `- NEVER joke about: ${forbidden.slice(0, 8).join(", ")}.`,
    "- If unsure whether a joke is appropriate — skip it.",
  ].join("\n");
}

export function isHumorSafe(text: string, forbiddenPhrases: string[]): boolean {
  const lower = text.toLowerCase();
  for (const topic of GLOBAL_HUMOR_FORBIDDEN) {
    if (lower.includes(topic)) return false;
  }
  for (const phrase of forbiddenPhrases) {
    if (phrase.trim() && lower.includes(phrase.toLowerCase())) return false;
  }
  return true;
}
