import type { UtterancePlan } from "@/lib/denis/cognition/tde/turn-plan-types";

export type TemplateLocale = "sr" | "de" | "en";

const TEMPLATE_CATALOG: Record<
  string,
  Partial<Record<TemplateLocale, string>>
> = {
  "banter.welcome": {
    sr: "Tu sam! Reci šta želiš — piće, jelo, ili da ti nešto preporučim sa menija?",
    de: "Ich bin da! Was darf ich bringen — Getränk, Essen, oder eine Empfehlung vom Menu?",
    en: "I'm here! What can I get you — a drink, something to eat, or a menu pick?",
  },
  "slot.clarify.serve_size": {
    sr: "Koju veličinu želiš — mala, srednja ili velika?",
    de: "Welche Größe soll es sein — klein, mittel oder groß?",
    en: "What size would you like — small, medium, or large?",
  },
  "slot.clarify.generic": {
    sr: "Treba mi još jedan detalj — možeš da preciziraš?",
    de: "Ich brauche noch ein Detail — kannst du das präzisieren?",
    en: "I need one more detail — can you clarify?",
  },
  "cart.conflict": {
    sr: "Vidim različite stavke na stolu — potvrdi šta želiš da pošaljemo.",
    de: "Ich sehe unterschiedliche Positionen am Tisch — bestätige bitte, was wir senden sollen.",
    en: "I see different items at the table — please confirm what we should send.",
  },
  "status.headline": {
    sr: "Tvoja porudžbina je u pripremi — javljam čim bude spremna.",
    de: "Deine Bestellung ist in Arbeit — ich melde mich, sobald sie fertig ist.",
    en: "Your order is in progress — I'll update you when it's ready.",
  },
  "status.no_order": {
    sr: "Još nemam poslatu porudžbinu za tvoj sto. Reci šta želiš — mogu odmah da pošaljem kad potvrdiš.",
    de: "Es ist noch keine Bestellung für deinen Tisch raus. Sag mir, was du möchtest — ich sende sie, sobald du bestätigst.",
    en: "I haven't sent an order for your table yet. Tell me what you'd like — I'll send it once you confirm.",
  },
  "settle.thanks": {
    sr: "Hvala! Uživaj u ostatku večeri — tu sam ako zatreba nešto.",
    de: "Danke! Genieß den Rest des Abends — ich bin da, falls du noch etwas brauchst.",
    en: "Thanks! Enjoy the rest of your evening — I'm here if you need anything.",
  },
  "proactive.browse": {
    sr: "Treba vam pomoć pri biranju?",
    de: "Brauchen Sie Hilfe bei der Auswahl?",
    en: "Need help choosing from the menu?",
  },
  "proactive.dessert": {
    sr: "Spremni za desert?",
    de: "Bereit für ein Dessert?",
    en: "Ready for dessert?",
  },
  "proactive.slow_kitchen": {
    sr: "Kuhinja radi intenzivno — želite nešto da popijete dok čekate?",
    de: "Die Küche ist gerade voll — möchten Sie etwas trinken, während Sie warten?",
    en: "The kitchen is busy — would you like a drink while you wait?",
  },
  "proactive.drink_pairing": {
    sr: "Uz to bi dobro leglo piće — da dodam nešto?",
    de: "Dazu passt ein Getränk — soll ich etwas vorschlagen?",
    en: "That pairs well with a drink — want me to suggest something?",
  },
};

export function resolveTemplateLocale(language: string): TemplateLocale {
  const code = language.trim().toLowerCase().slice(0, 2);
  if (code === "sr" || code === "hr" || code === "bs") return "sr";
  if (code === "de") return "de";
  return "en";
}

/**
 * Template-first utterance (0 tokens). Returns null when key/locale missing.
 */
export function tryTemplateUtterance(plan: UtterancePlan): string | null {
  if (!plan.useTemplate) return null;

  const locale = resolveTemplateLocale(plan.language);
  const row = TEMPLATE_CATALOG[plan.templateKey];
  if (!row) return null;

  return row[locale] ?? row.en ?? null;
}

export function listTemplateKeys(): string[] {
  return Object.keys(TEMPLATE_CATALOG);
}
