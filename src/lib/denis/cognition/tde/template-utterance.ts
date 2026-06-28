import type { UtterancePlan } from "@/lib/denis/cognition/tde/turn-plan-types";

export type TemplateLocale = "sr" | "de" | "en";

const TEMPLATE_CATALOG: Record<
  string,
  Partial<Record<TemplateLocale, string>>
> = {
  "banter.welcome": {
    sr: "Dobar dan i dobrodošli! Tu sam — kako vam mogu pomoći? Da li ste već odlučili šta biste želeli — piće ili nešto za jelo?",
    de: "Guten Tag und willkommen! Ich bin für Sie da — wie darf ich Ihnen helfen? Haben Sie schon entschieden, was Sie trinken oder essen möchten?",
    en: "Good day and welcome! I'm here for you — how may I help? Have you already decided on a drink or something to eat?",
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
    sr: "Još nisam poslao porudžbinu u kuhinju. Reci šta želiš — pošaljem čim potvrdiš.",
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
  "proactive.scroll_search": {
    sr: "Tražite nešto? Mogu pomoći!",
    de: "Suchen Sie etwas Bestimmtes? Ich helfe gern!",
    en: "Looking for something? I can help!",
  },
  "proactive.scroll_category": {
    sr: "Naši burgeri su hit danas!",
    de: "Diese Kategorie ist heute beliebt!",
    en: "This category is popular tonight!",
  },
  "proactive.scroll_bottom": {
    sr: "Nešto vas zanima? Pitajte me!",
    de: "Interessiert Sie etwas? Fragen Sie mich!",
    en: "See something you like? Just ask!",
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
  "proactive.drink_with_food": {
    sr: "Uz jelo odlično ide piće — da preporučim nešto konkretno?",
    de: "Zum Essen passt ein Getränk — soll ich etwas Konkretes vorschlagen?",
    en: "That dish pairs with a drink — want a specific suggestion?",
  },
  "proactive.drink_refill": {
    sr: "Hoćete li još jedno piće? Ili da probate nešto drugo?",
    de: "Möchten Sie noch ein Getränk? Oder etwas anderes probieren?",
    en: "Would you like another drink? Or try something different?",
  },
  "proactive.round_two": {
    sr: "Još jedna runda za sto?",
    de: "Noch eine Runde für den Tisch?",
    en: "Another round for the table?",
  },
  "proactive.happy_hour_upsell": {
    sr: "Trenutno je Happy Hour — sva pića po specijalnoj ceni!",
    de: "Gerade Happy Hour — alle Getränke zum Sonderpreis!",
    en: "It's Happy Hour — all drinks at special prices!",
  },
  "proactive.guest_welcome": {
    sr: "Dobar dan i dobrodošli u {venueName}! Tu sam — da li ste već odlučili šta biste želeli?",
    de: "Guten Tag und willkommen im {venueName}! Haben Sie schon entschieden, was Sie möchten?",
    en: "Good day and welcome to {venueName}! Have you already decided what you'd like?",
  },
  "proactive.browse_follow_up": {
    sr: "Da li ste već odlučili? Mogu li nekako da pomognem?",
    de: "Haben Sie sich schon entschieden? Kann ich Ihnen helfen?",
    en: "Have you decided yet? Can I help you somehow?",
  },
  "browse.defer_ack": {
    sr: "U redu, javljam se za koji minut.",
    de: "Alles klar, ich melde mich in einer Minute.",
    en: "Sure, I'll check back in a minute.",
  },
  "browse.defer_ack_repeat": {
    sr: "U redu, tu sam kad zatreba.",
    de: "Alles klar, ich bin da, wenn Sie bereit sind.",
    en: "Sure, I'm here whenever you need me.",
  },
  "proactive.bill_prompt": {
    sr: "Hoćete da zatvorimo račun? Možete platiti ovde ili pozvati konobara.",
    de: "Möchten Sie die Rechnung? Sie können hier zahlen oder den Kellner rufen.",
    en: "Ready to close the bill? Pay here or call the waiter.",
  },
  "proactive.order_delay": {
    sr: "Vaša narudžbina se priprema, stiže uskoro. Hvala na strpljenju!",
    de: "Ihre Bestellung wird zubereitet und kommt gleich. Danke für Ihre Geduld!",
    en: "Your order is being prepared and will arrive soon. Thanks for your patience!",
  },
  "proactive.order_eta_update": {
    sr: "Vaša narudžbina se priprema — javljam vam tačan ETA čim ga imam.",
    de: "Ihre Bestellung wird zubereitet — ich melde mich mit dem genauen ETA.",
    en: "Your order is being prepared — I'll update you with the exact ETA.",
  },
  "proactive.kitchen_busy_preorder": {
    sr: "Kuhinja je trenutno zauzeta — želite da naručite ili da sačekate?",
    de: "Die Küche ist voll — möchten Sie bestellen oder warten?",
    en: "The kitchen is busy — would you like to order or wait?",
  },
  "proactive.order_ready": {
    sr: "Vaše jelo je spremno!",
    de: "Ihr Essen ist fertig!",
    en: "Your food is ready!",
  },
  "proactive.kitchen_busy": {
    sr: "Kuhinja je trenutno zauzeta — narudžbe mogu potrajati malo duže.",
    de: "Die Küche ist gerade stark ausgelastet.",
    en: "The kitchen is busy right now.",
  },
  "proactive.popularity_pair": {
    sr: "Gosti koji naruče ovo često uzmu i nešto uz to — hoćete da dodam?",
    de: "Gäste bestellen das oft mit einem passenden Extra — soll ich etwas vorschlagen?",
    en: "Guests often add a popular pairing — want me to suggest one?",
  },
  "proactive.attention_handoff": {
    sr: "Izvinite zbog čekanja — obavestio sam konobara da dođe.",
    de: "Es tut mir leid für die Wartezeit — ich habe den Kellner informiert.",
    en: "Sorry for the wait — I've notified the waiter to come over.",
  },
  "mental.attention_handoff": {
    sr: "Razumem — obavestio sam konobara. Doći će uskoro.",
    de: "Verstanden — ich habe den Kellner informiert. Er kommt gleich.",
    en: "Understood — I've notified the waiter. They'll be right over.",
  },
  "waiter.gap_clarify.drink": {
    sr: "Pre nego što pošaljem — koji tip piva želite? Na primer Pilsner ili Weizen, 0.3L ili 0.5L.",
    de: "Bevor ich sende — welches Bier möchten Sie? Z. B. Pilsner oder Weizen, 0.3L oder 0.5L.",
    en: "Before I send — which beer would you like? e.g. Pilsner or Weizen, 0.3L or 0.5L.",
  },
  "waiter.gap_clarify.serve_size": {
    sr: "Koju veličinu želite — 0.3L ili 0.5L?",
    de: "Welche Größe — 0.3L oder 0.5L?",
    en: "What size — 0.3L or 0.5L?",
  },
  "waiter.gap_clarify.substitution": {
    sr: "Imam napomenu za kuhinju — potvrdite zamenu pre slanja.",
    de: "Ich habe eine Notiz für die Küche — bitte bestätigen Sie die Änderung vor dem Senden.",
    en: "I have a note for the kitchen — please confirm the swap before sending.",
  },
  "waiter.gap_clarify.generic": {
    sr: "Pre slanja treba mi još jedan detalj — možete da precizirate?",
    de: "Bevor ich sende brauche ich noch ein Detail — können Sie das präzisieren?",
    en: "Before I send I need one more detail — can you clarify?",
  },
  "preorder.confirmation": {
    sr: "Narudžba je zakazana — vidimo se uskoro!",
    de: "Bestellung geplant — bis gleich!",
    en: "Order scheduled — see you soon!",
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
  return templateUtteranceForKey(plan.templateKey, plan.language);
}

/** Localized template line — use instead of hardcoded EN fallbacks. */
export function templateUtteranceForKey(
  templateKey: string,
  language: string
): string | null {
  const locale = resolveTemplateLocale(language);
  const row = TEMPLATE_CATALOG[templateKey];
  if (!row) return null;
  return row[locale] ?? row.en ?? null;
}

export function defaultGuestChatFallback(language: string): string {
  return (
    templateUtteranceForKey("banter.welcome", language) ??
    "Good day and welcome! How may I help?"
  );
}

export function listTemplateKeys(): string[] {
  return Object.keys(TEMPLATE_CATALOG);
}
