import type { AiExampleRow } from "@/lib/ai/playbook/types";
import type { PlaybookPackDefinition } from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import type { ConciergeToneSchema } from "@/lib/denis/config/concierge-config.schema";
import type { z } from "zod";

export type VenueType =
  | "restaurant"
  | "bar"
  | "cafe"
  | "fast_food"
  | "hotel"
  | "lounge";

export type PriceRange = "budget" | "mid" | "premium";

export type TonePreference = "relaxed" | "formal" | "luxury";

export type PlaybookInput = {
  venueName: string;
  venueType: VenueType;
  menuSections: string[];
  priceRange: PriceRange;
  topProducts: { name: string; category: string }[];
  specialties: string[];
  language: string;
  tonePreference?: TonePreference;
};

export type GeneratedVenuePlaybook = PlaybookPackDefinition & {
  tone: z.infer<typeof ConciergeToneSchema>;
};

const MAX_PLAYBOOK_RULES = 10;

function packExample(
  category: AiExampleRow["category"],
  userMessage: string,
  assistantMessage: string,
  assistantJson?: Record<string, unknown>
): AiExampleRow {
  return {
    id: `generated-${category}`,
    org_id: "generated",
    location_id: null,
    category,
    user_message: userMessage,
    assistant_message: assistantMessage,
    assistant_json: assistantJson ?? null,
    sort_order: 0,
    is_active: true,
  };
}

function slugifyVenueName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "venue"
  );
}

/** Resolve Denis concierge tone from venue profile + owner preference. */
export function resolveVenuePlaybookTone(
  input: Pick<
    PlaybookInput,
    "venueType" | "priceRange" | "tonePreference"
  >
): z.infer<typeof ConciergeToneSchema> {
  if (input.tonePreference === "formal") return "formal";
  if (input.tonePreference === "luxury") return "playful_luxury";
  if (input.tonePreference === "relaxed") return "warm_short";

  if (input.venueType === "fast_food") return "efficient";
  if (input.venueType === "hotel") return "formal";

  if (
    (input.venueType === "bar" || input.venueType === "lounge") &&
    input.priceRange === "premium"
  ) {
    return "playful_luxury";
  }

  if (input.priceRange === "premium") return "playful_luxury";
  if (input.priceRange === "budget") return "efficient";
  return "warm_short";
}

function toneDescription(
  tone: z.infer<typeof ConciergeToneSchema>,
  language: string
): string {
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");

  if (tone === "playful_luxury") {
    if (isDe) return "kurz, luxuriös, leicht verspielt — kein Hotel-Standard";
    if (isEn) return "short, luxurious, lightly playful — not corporate hotel tone";
    return "kratko, luksuzno, blago razigrano — bez hotelskog šablona";
  }
  if (tone === "formal") {
    if (isDe) return "höflich und professionell — keine Umgangssprache";
    if (isEn) return "polite and professional — no slang";
    return "pristojan i profesionalan — bez slenga";
  }
  if (tone === "efficient") {
    if (isDe) return "schnell und klar — keine langen Erklärungen";
    if (isEn) return "fast and clear — no long explanations";
    return "brzo i jasno — bez dugih objašnjenja";
  }
  if (isDe) return "warm und locker — wie mit einem guten Kellner";
  if (isEn) return "warm and relaxed — like chatting with a good server";
  return "topao i opušten — kao razgovor sa dobrom konobaricom";
}

function greetingRule(input: PlaybookInput): string {
  const { venueType, venueName, topProducts, language } = input;
  const flagship = topProducts[0]?.name ?? input.specialties[0];
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");

  if (venueType === "bar" || venueType === "lounge") {
    const drinkHint =
      flagship ??
      (isDe ? "einen Signature-Cocktail" : isEn ? "a signature cocktail" : "signature koktel");
    if (isDe) {
      return `Pozdrav: spomeni ${venueName}; ponudi ${drinkHint} pre hrane (cocktail-first flow)`;
    }
    if (isEn) {
      return `Greeting: mention ${venueName}; offer ${drinkHint} before food (cocktail-first flow)`;
    }
    return `Pozdrav: spomeni ${venueName}; ponudi ${drinkHint} pre jela (cocktail-first flow)`;
  }

  if (venueType === "cafe") {
    const coffeeHint =
      flagship ??
      (isDe ? "Kaffee oder Tee" : isEn ? "coffee or tea" : "kafu ili čaj");
    if (isDe) return `Pozdrav: kurz willkommen; ponudi ${coffeeHint}`;
    if (isEn) return `Greeting: brief welcome; offer ${coffeeHint}`;
    return `Pozdrav: kratak pozdrav; ponudi ${coffeeHint}`;
  }

  if (venueType === "fast_food") {
    if (isDe) return "Pozdrav: direkt fragen was bestellt werden soll — kein Smalltalk";
    if (isEn) return "Greeting: ask what to order directly — no small talk";
    return "Pozdrav: odmah pitaj šta naručuju — bez small talka";
  }

  const foodHint =
    flagship ??
    (isDe ? "eine Empfehlung" : isEn ? "a house recommendation" : "kućnu preporuku");
  if (isDe) {
    return `Pozdrav: spomeni ${venueName}; ponudi piće ili ${foodHint}`;
  }
  if (isEn) {
    return `Greeting: mention ${venueName}; offer a drink or ${foodHint}`;
  }
  return `Pozdrav: spomeni ${venueName}; ponudi piće ili ${foodHint}`;
}

function drinkRule(input: PlaybookInput): string | null {
  const { venueType, menuSections, topProducts, language } = input;
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");

  const drinkProducts = topProducts.filter((p) =>
    /cocktail|drink|piće|pivo|vino|wine|beer|bar|kafa|coffee|tea|čaj/i.test(
      `${p.category} ${p.name}`
    )
  );
  const drinkNames = drinkProducts.slice(0, 3).map((p) => p.name);

  if (venueType === "bar" || venueType === "lounge") {
    const list =
      drinkNames.length > 0
        ? drinkNames.join(", ")
        : isDe
          ? "Signature-Cocktails oder lokale Weine"
          : isEn
            ? "signature cocktails or local wines"
            : "signature koktele ili lokalna vina";
    if (isDe) return `Piće: preporuči ${list} kad gost traži preporuku`;
    if (isEn) return `Drinks: recommend ${list} when guest asks for suggestions`;
    return `Piće: preporuči ${list} kad gost traži preporuku`;
  }

  if (menuSections.some((s) => /cocktail|bar|drink|piće/i.test(s))) {
    const list =
      drinkNames[0] ??
      (isDe ? "Hausgetränk" : isEn ? "house drink" : "kućno piće");
    if (isDe) return `Piće: pitaj veličinu/tip jednom; preporuči ${list} ako traže savet`;
    if (isEn) return `Drinks: ask size/type once; suggest ${list} if they want a recommendation`;
    return `Piće: pitaj veličinu/tip jednom; preporuči ${list} ako traže savet`;
  }

  return null;
}

function recommendationRule(input: PlaybookInput): string | null {
  const { venueType, specialties, topProducts, language } = input;
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");

  if (specialties.length > 0) {
    const list = specialties.slice(0, 2).join(", ");
    if (isDe) return `Preporuka: istakni kućne specijalitete — ${list}`;
    if (isEn) return `Recommendations: highlight house specialties — ${list}`;
    return `Preporuka: istakni kućne specijalitete — ${list}`;
  }

  if (topProducts.length >= 2 && venueType === "restaurant") {
    const names = topProducts.slice(0, 2).map((p) => p.name).join(" ili ");
    if (isDe) return `Preporuka: za neodlučne goste ponudi ${names}`;
    if (isEn) return `Recommendations: for undecided guests offer ${names}`;
    return `Preporuka: za neodlučne goste ponudi ${names}`;
  }

  if (venueType === "hotel") {
    if (isDe) return "Preporuka: neutralan hotelski standard — bez lokalnih imena jela";
    if (isEn) return "Recommendations: neutral hotel standard — no local dish storytelling";
    return "Preporuka: neutralan hotelski standard — bez lokalnog storytellinga";
  }

  return null;
}

function forbiddenRule(input: PlaybookInput): string {
  const { venueType, language } = input;
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");

  if (venueType === "bar" || venueType === "lounge") {
    if (isDe) return "Nikad: kein generisches „Willkommen im Restaurant“ — immer Bar/Lounge-Kontext";
    if (isEn) return "Never: no generic “Welcome to the restaurant” — always bar/lounge context";
    return "Nikad: ne koristi generički „Dobrodošli u restoran“ — uvek bar/lounge kontekst";
  }
  if (venueType === "hotel") {
    if (isDe) return "Nikad: keine Boutique- oder Signature-Geschichten — nur klare Bestellfragen";
    if (isEn) return "Never: no boutique or signature storytelling — clear order questions only";
    return "Nikad: bez boutique ili signature priča — samo jasna pitanja za porudžbinu";
  }
  if (isDe) return "Nikad: nicht mehr als einmal „Noch etwas?“ pro Session";
  if (isEn) return "Never: ask “anything else?” more than once per session";
  return "Nikad: ne pitaj „još nešto?“ više od jednom po sesiji";
}

function upsellRule(input: PlaybookInput): string | null {
  const { venueType, menuSections, language } = input;
  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");
  const hasDessert = menuSections.some((s) => /dessert|dezert|slat/i.test(s));

  if (!hasDessert) return null;

  if (venueType === "fast_food") return null;

  if (isDe) return "Posle glavnog jela: jednom pitaj za desert — ne insistiraj";
  if (isEn) return "After mains: ask about dessert once — do not push";
  return "Posle glavnog jela: jednom pitaj za desert — ne insistiraj";
}

function groupRule(input: PlaybookInput): string | null {
  const { venueType, language } = input;
  if (venueType !== "restaurant" && venueType !== "bar") return null;

  const isDe = language.startsWith("de");
  const isEn = language.startsWith("en");
  if (isDe) return "Gruppen: ponudi sharing/platter opciju kad party ≥ 3";
  if (isEn) return "Groups: suggest sharing/platter options when party size ≥ 3";
  return "Grupe: ponudi sharing/platter opciju kad party ≥ 3";
}

function buildPlaybookRules(input: PlaybookInput, tone: z.infer<typeof ConciergeToneSchema>): string[] {
  const rules: string[] = [
    `Ton: ${toneDescription(tone, input.language)} (tone=${tone})`,
    greetingRule(input),
  ];

  const drink = drinkRule(input);
  if (drink) rules.push(drink);

  const rec = recommendationRule(input);
  if (rec) rules.push(rec);

  const group = groupRule(input);
  if (group) rules.push(group);

  const upsell = upsellRule(input);
  if (upsell) rules.push(upsell);

  rules.push(forbiddenRule(input));

  if (input.venueType === "fast_food") {
    const isDe = input.language.startsWith("de");
    const isEn = input.language.startsWith("en");
    rules.push(
      isDe
        ? "Flow: veličina/modifikator jednom — odmah potvrdi porudžbinu"
        : isEn
          ? "Flow: size/modifier once — confirm order immediately"
          : "Flow: veličina/modifikator jednom — odmah potvrdi porudžbinu"
    );
  }

  return rules.slice(0, MAX_PLAYBOOK_RULES);
}

function buildExamples(
  input: PlaybookInput,
  tone: z.infer<typeof ConciergeToneSchema>
): AiExampleRow[] {
  const isDe = input.language.startsWith("de");
  const isEn = input.language.startsWith("en");
  const flagship = input.topProducts[0]?.name ?? input.specialties[0];

  if (input.venueType === "bar" && tone === "playful_luxury") {
    const cocktail =
      flagship ??
      (isDe ? "Signature Negroni" : isEn ? "Signature Negroni" : "Signature Negroni");
    const greeting = isDe
      ? `Guten Abend — willkommen in ${input.venueName}. Darf ich Ihnen einen ${cocktail} empfehlen, bevor Sie essen wählen?`
      : isEn
        ? `Good evening — welcome to ${input.venueName}. May I suggest a ${cocktail} before you choose food?`
        : `Dobro veče — dobrodošli u ${input.venueName}. Da li da krenemo sa ${cocktail} pre jela?`;

    return [
      packExample("general", isDe ? "Hallo" : isEn ? "Hello" : "Zdravo", greeting, {
        intent: "chat",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
        message: greeting,
      }),
    ];
  }

  const greeting = isDe
    ? `Guten Tag! Willkommen in ${input.venueName}. Was darf es sein — Getränk oder Essen?`
    : isEn
      ? `Hello! Welcome to ${input.venueName}. What can I get you — a drink or something to eat?`
      : `Zdravo! Dobrodošli u ${input.venueName}. Šta da bude — piće ili nešto za jelo?`;

  return [
    packExample("general", isDe ? "Hallo" : isEn ? "Hello" : "Zdravo", greeting, {
      intent: "chat",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      message: greeting,
    }),
  ];
}

/** Generate a venue-specific playbook pack from onboarding + VKG menu hints. */
export function generateVenuePlaybook(input: PlaybookInput): GeneratedVenuePlaybook {
  const tone = resolveVenuePlaybookTone(input);
  const rules = buildPlaybookRules(input, tone);
  const header = `${input.venueName.trim().toUpperCase()} PLAYBOOK:`;
  const playbook = [header, ...rules.map((r) => `- ${r}`)].join("\n");

  return {
    id: `generated-${slugifyVenueName(input.venueName)}`,
    playbook,
    examples: buildExamples(input, tone),
    tone,
  };
}
