import type { AiExampleRow } from "@/lib/ai/playbook/types";
import { buildManifestPersonalityOverlay } from "@/lib/denis/cognition/personality/personality-engine";
import type { ConciergePersona } from "@/lib/denis/config/concierge-config.schema";
import type { CustomPlaybookPack } from "@/lib/denis/cognition/manifest/venue-manifest.schema";

export const PlaybookPackToneSchema = ["formal", "casual", "fun"] as const;
export type PlaybookPackTone = (typeof PlaybookPackToneSchema)[number];

export const PlaybookUpsellStyleSchema = [
  "gentle",
  "confident",
  "enthusiastic",
] as const;
export type PlaybookUpsellStyle = (typeof PlaybookUpsellStyleSchema)[number];

export type PlaybookLanguagePreferences = {
  primary: string;
  secondary?: string | null;
};

export type PlaybookPackDefinition = {
  id: string;
  label: string;
  description: string;
  tone: PlaybookPackTone;
  upsellStyle: PlaybookUpsellStyle;
  languagePreferences: PlaybookLanguagePreferences;
  signaturePhrases: string[];
  menuHighlights: string[];
  forbiddenTopics: string[];
  welcomeTemplate: string;
  playbook: string;
  examples: AiExampleRow[];
};

function packExample(
  category: AiExampleRow["category"],
  userMessage: string,
  assistantMessage: string,
  assistantJson?: Record<string, unknown>
): AiExampleRow {
  return {
    id: `pack-${category}-${userMessage.slice(0, 12)}`,
    org_id: "pack",
    location_id: null,
    category,
    user_message: userMessage,
    assistant_message: assistantMessage,
    assistant_json: assistantJson ?? null,
    sort_order: 0,
    is_active: true,
  };
}

function assistantJson(message: string, intent: string = "order") {
  return {
    intent,
    recommendations: [],
    proposedItems: [],
    quickReplies: [],
    submitOrder: intent === "order" || intent === "confirm",
    message,
  };
}

function renderPackRules(pack: Omit<PlaybookPackDefinition, "playbook" | "examples">): string {
  const languages = pack.languagePreferences.secondary
    ? `${pack.languagePreferences.primary} (primary), ${pack.languagePreferences.secondary} (secondary)`
    : pack.languagePreferences.primary;

  return [
    `PLAYBOOK PACK (${pack.id}):`,
    `- Tone: ${pack.tone}`,
    `- Upsell style: ${pack.upsellStyle}`,
    `- Languages: ${languages}`,
    `- Signature phrases (weave in naturally): ${pack.signaturePhrases.join(" · ")}`,
    `- Menu highlights: ${pack.menuHighlights.join(" · ")}`,
    `- Forbidden topics: never discuss ${pack.forbiddenTopics.join(", ")}`,
    `- Welcome template: ${pack.welcomeTemplate}`,
    pack.tone === "formal"
      ? "- Address guests politely (Sie-form in DE); no slang."
      : pack.tone === "casual"
        ? "- Keep it relaxed and friendly; short sentences OK."
        : "- Playful energy — light humor OK, never at guest expense.",
    pack.upsellStyle === "gentle"
      ? "- Upsell once, softly — accept no without repeating."
      : pack.upsellStyle === "confident"
        ? "- Recommend one clear add-on with brief reason."
        : "- Enthusiastic pairing suggestions when guest shows interest.",
  ].join("\n");
}

function buildPackDefinition(
  input: Omit<PlaybookPackDefinition, "playbook">
): PlaybookPackDefinition {
  return {
    ...input,
    playbook: renderPackRules(input),
  };
}

/** Platform playbook packs — org/location manifest `playbookPackId` (MR-9 / Prompt 36). */
export const PLAYBOOK_PACK_REGISTRY: Record<string, PlaybookPackDefinition> = {
  "formal-de": buildPackDefinition({
    id: "formal-de",
    label: "Formal · Deutsch",
    description: "Fine dining — polite Sie-form, gentle upsell",
    tone: "formal",
    upsellStyle: "gentle",
    languagePreferences: { primary: "de", secondary: "en" },
    signaturePhrases: ["Guten Appetit!", "Lass dir's schmecken!"],
    menuHighlights: ["Naš Schnitzel je legenda"],
    forbiddenTopics: ["politika", "religija"],
    welcomeTemplate: "Willkommen bei {orgName}!",
    examples: [
      packExample(
        "order",
        "Daj mi burger",
        "Sehr gerne. Dürfte ich Ihnen unseren Beef Burger empfehlen? Guten Appetit!",
        assistantJson(
          "Sehr gerne. Dürfte ich Ihnen unseren Beef Burger empfehlen? Guten Appetit!"
        )
      ),
      packExample(
        "general",
        "Zdravo",
        "Willkommen! Guten Appetit — darf ich Ihnen etwas aus der Speisekarte empfehlen?",
        assistantJson(
          "Willkommen! Guten Appetit — darf ich Ihnen etwas aus der Speisekarte empfehlen?",
          "chat"
        )
      ),
    ],
  }),
  "casual-de": buildPackDefinition({
    id: "casual-de",
    label: "Casual · Beach bar",
    description: "Relaxed beach-bar tone — enthusiastic upsell",
    tone: "casual",
    upsellStyle: "enthusiastic",
    languagePreferences: { primary: "de", secondary: "sr" },
    signaturePhrases: ["Lass dir's schmecken!", "Prost!"],
    menuHighlights: ["Craft IPA je hit ovog leta"],
    forbiddenTopics: ["politika", "religija"],
    welcomeTemplate: "Hey — willkommen bei {orgName}!",
    examples: [
      packExample(
        "order",
        "Daj mi burger",
        "Klar, ein Burger! Lass dir's schmecken — soll ich Pommes oder ein kühles Bier dazu packen?",
        assistantJson(
          "Klar, ein Burger! Lass dir's schmecken — soll ich Pommes oder ein kühles Bier dazu packen?"
        )
      ),
      packExample(
        "general",
        "Zdravo",
        "Hey, dobrodošli! Lass dir's schmecken — šta pijemo prvo?",
        assistantJson("Hey, dobrodošli! Lass dir's schmecken — šta pijemo prvo?", "chat")
      ),
    ],
  }),
  "fun-de": buildPackDefinition({
    id: "fun-de",
    label: "Fun · Party",
    description: "High-energy fun tone — confident upsell",
    tone: "fun",
    upsellStyle: "confident",
    languagePreferences: { primary: "de" },
    signaturePhrases: ["Prost!", "Guten Appetit!"],
    menuHighlights: ["Share platters for the table"],
    forbiddenTopics: ["politika", "religija"],
    welcomeTemplate: "Willkommen bei {orgName} — let's eat!",
    examples: [
      packExample(
        "order",
        "Daj mi burger",
        "Ein Burger — gute Wahl! Prost! Soll ich die legendäre Pommes dazu schicken?",
        assistantJson(
          "Ein Burger — gute Wahl! Prost! Soll ich die legendäre Pommes dazu schicken?"
        )
      ),
    ],
  }),
  skyline: buildPackDefinition({
    id: "skyline",
    label: "Skyline Lounge",
    description: "Boutique lounge — cocktails first",
    tone: "formal",
    upsellStyle: "gentle",
    languagePreferences: { primary: "sr", secondary: "en" },
    signaturePhrases: ["Dobro veče"],
    menuHighlights: ["Signature kokteli"],
    forbiddenTopics: ["politika"],
    welcomeTemplate: "Dobrodošli u Skyline Lounge!",
    examples: [
      packExample(
        "general",
        "Zdravo",
        "Dobro veče — dobrodošli u Skyline Lounge. Da li želite koktel ili čašu vina dok birate?",
        assistantJson(
          "Dobro veče — dobrodošli u Skyline Lounge. Da li želite koktel ili čašu vina dok birate?",
          "chat"
        )
      ),
    ],
  }),
  "generic-chain": buildPackDefinition({
    id: "generic-chain",
    label: "Chain hotel",
    description: "Neutral efficient chain standard",
    tone: "formal",
    upsellStyle: "gentle",
    languagePreferences: { primary: "en" },
    signaturePhrases: [],
    menuHighlights: [],
    forbiddenTopics: [],
    welcomeTemplate: "Good evening. Welcome to {orgName}.",
    examples: [
      packExample(
        "general",
        "Hello",
        "Good evening. What would you like to order — a drink or something to eat?",
        assistantJson(
          "Good evening. What would you like to order — a drink or something to eat?",
          "chat"
        )
      ),
    ],
  }),
};

export const PLAYBOOK_PACK_OPTIONS = Object.values(PLAYBOOK_PACK_REGISTRY).map(
  (pack) => ({
    id: pack.id,
    label: pack.label,
    description: pack.description,
    tone: pack.tone,
  })
);

export function buildCustomPlaybookPackDefinition(
  custom: CustomPlaybookPack
): PlaybookPackDefinition {
  return buildPackDefinition({
    id: "custom",
    label: "Custom",
    description: "Venue-specific playbook",
    tone: custom.tone,
    upsellStyle: custom.upsellStyle,
    languagePreferences: custom.languagePreferences,
    signaturePhrases: custom.signaturePhrases,
    menuHighlights: custom.menuHighlights,
    forbiddenTopics: custom.forbiddenTopics,
    welcomeTemplate: custom.welcomeTemplate,
    examples: [],
  });
}

export function resolvePlaybookPackDefinition(
  packId: string | null | undefined,
  customPack?: CustomPlaybookPack | null
): PlaybookPackDefinition | null {
  const trimmed = packId?.trim();
  if (trimmed === "custom" && customPack) {
    return buildCustomPlaybookPackDefinition(customPack);
  }
  if (!trimmed) return null;
  return PLAYBOOK_PACK_REGISTRY[trimmed] ?? null;
}

export function interpolateWelcomeTemplate(
  template: string,
  orgName: string
): string {
  return template.replace(/\{orgName\}/g, orgName.trim() || "Restaurant");
}

/** Merge venue playbook with active ConciergePersona overlay (Prompt 85). */
export function formatPlaybookWithPersona(
  pack: PlaybookPackDefinition,
  persona: ConciergePersona
): string {
  const overlay = buildManifestPersonalityOverlay(persona, pack.playbook);
  return [pack.playbook, overlay].filter(Boolean).join("\n\n");
}
