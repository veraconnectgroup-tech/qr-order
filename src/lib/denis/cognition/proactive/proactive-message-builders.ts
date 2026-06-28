import {
  buildVenueWelcomeMessage,
} from "@/lib/denis/cognition/conversation/guest-continuity";
import {
  buildServicePeriodGreeting,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { VenueServicePeriod } from "@/lib/denis/config/rhythm-prior-types";

type KitchenMessageLang = "sr" | "de" | "en";

function resolveKitchenLang(language: string | null | undefined): KitchenMessageLang {
  const lang = language?.trim().toLowerCase();
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

export function buildWelcomeMessage(
  venueName: string | null | undefined,
  language: string | null | undefined,
  todaySpecial: string | null | undefined,
  fallback: string,
  rhythmTopProductName?: string | null,
  servicePeriod?: VenueServicePeriod | null
): string {
  const special = todaySpecial?.trim();
  const venue = venueName?.trim();
  const lang = language?.trim() || "sr";
  const rhythmProduct = rhythmTopProductName?.trim();

  if (servicePeriod) {
    const periodGreeting = buildServicePeriodGreeting({
      servicePeriod,
      language: lang,
      todaySpecial: special,
      topProductName: rhythmProduct,
    });
    if (venue && !special && !rhythmProduct) {
      return `${periodGreeting} Dobrodošli u ${venue}!`;
    }
    if (venue) {
      return `${periodGreeting} (${venue})`;
    }
    return periodGreeting;
  }

  if (venue) {
    const base = buildVenueWelcomeMessage(venue, lang);
    if (special) {
      return `${base} Specijal danas: ${special}.`;
    }
    if (rhythmProduct) {
      return `${base} Večeras je ${rhythmProduct} favorit — mogu da preporučim.`;
    }
    return base;
  }
  if (special) {
    return `Dobro došli! Naš specijal danas je ${special}. Hoćete da pogledate meni?`;
  }
  if (rhythmProduct) {
    return `Dobrodošli! ${rhythmProduct} je večeras favorit. Hoćete da pogledate meni?`;
  }
  return fallback;
}

export function buildDessertMessage(
  dessertProductName: string | null | undefined,
  fallback: string
): string {
  const dessert = dessertProductName?.trim();
  if (!dessert) return fallback;
  return `Kako vam je bilo? Imamo odličan ${dessert} — hoćete da dodam?`;
}

export function buildOrderDelayMessage(input?: {
  language?: string | null;
  remainingEtaMinutes?: number | null;
  estimatedPrepMinutes?: number | null;
  orderItemsLabel?: string | null;
  fallback?: string;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const eta =
    input?.remainingEtaMinutes ??
    input?.estimatedPrepMinutes ??
    null;
  const items = input?.orderItemsLabel?.trim();

  if (eta != null && eta > 0) {
    if (lang === "de") {
      return items
        ? `${items} wird zubereitet — fertig in ca. ${eta} Min. Danke für Ihre Geduld!`
        : `Ihre Bestellung wird zubereitet — fertig in ca. ${eta} Min. Danke für Ihre Geduld!`;
    }
    if (lang === "en") {
      return items
        ? `${items} are being prepared — ready in ~${eta} min. Thanks for your patience!`
        : `Your order is being prepared — ready in ~${eta} min. Thanks for your patience!`;
    }
    return items
      ? `${items} se priprema — biće gotovo za ~${eta} min. Hvala na strpljenju!`
      : `Vaša narudžbina se priprema — biće gotova za ~${eta} min. Hvala na strpljenju!`;
  }

  return (
    input?.fallback ??
    "Vaša narudžbina se priprema, stiže uskoro. Hvala na strpljenju!"
  );
}

export function buildSlowKitchenMessage(input?: {
  hasActiveDrinkOrder?: boolean;
  language?: string | null;
  waitMinutes?: number;
  remainingEtaMinutes?: number | null;
  estimatedPrepMinutes?: number | null;
  prepEstimateConfidence?: string | null;
  delaySeverity?: string | null;
  offerDrink?: boolean;
  orderItemsLabel?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const offerDrink =
    input?.offerDrink !== false && !input?.hasActiveDrinkOrder;
  const eta =
    input?.remainingEtaMinutes ??
    (input?.estimatedPrepMinutes != null
      ? Math.max(1, input.estimatedPrepMinutes)
      : null);

  if (eta != null) {
    if (lang === "de") {
      const base = `Danke für Ihre Geduld — die Küche arbeitet an Ihrer Bestellung, ca. ${eta} Min.`;
      return offerDrink
        ? `${base} Möchten Sie etwas trinken, während Sie warten?`
        : base;
    }
    if (lang === "en") {
      const base = `Thanks for your patience — the kitchen is finishing your order in ~${eta} min.`;
      return offerDrink
        ? `${base} Would you like something to drink while you wait?`
        : base;
    }
    const base = `Hvala na strpljenju — kuhinja završava vašu narudžbu, biće gotova za ~${eta} min.`;
    return offerDrink
      ? `${base} Želite li nešto da popijete dok čekate?`
      : base;
  }

  if (input?.hasActiveDrinkOrder || input?.offerDrink === false) {
    return "Hvala na strpljenju — kuhinja završava vašu narudžbu.";
  }
  return "Hvala na strpljenju — kuhinja završava vašu narudžbu. Želite li nešto da popijete dok čekate?";
}

export function buildOrderReadyMessage(input?: {
  language?: string | null;
  orderItemsLabel?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const items = input?.orderItemsLabel?.trim();

  if (lang === "de") {
    return items ? `🔔 ${items} ${items.includes("+") ? "sind" : "ist"} fertig!` : "🔔 Ihr Essen ist fertig!";
  }
  if (lang === "en") {
    return items ? `🔔 ${items} ${items.includes("+") ? "are" : "is"} ready!` : "🔔 Your food is ready!";
  }
  return items ? `🔔 ${items} ${items.includes("+") ? "su" : "je"} spremn${items.includes("+") ? "i" : "o"}!` : "🔔 Vaše jelo je spremno!";
}

export function buildKitchenBusyMessage(input?: {
  language?: string | null;
  estimatedWaitMinutes?: number | null;
  pendingCount?: number | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const wait = input?.estimatedWaitMinutes;

  if (lang === "de") {
    return wait != null && wait > 0
      ? `Die Küche ist gerade stark ausgelastet — Rechnen Sie mit ca. ${wait} Min. Wartezeit.`
      : "Die Küche ist gerade stark ausgelastet — es kann etwas länger dauern.";
  }
  if (lang === "en") {
    return wait != null && wait > 0
      ? `The kitchen is busy right now — expect about ${wait} min wait.`
      : "The kitchen is busy right now — orders may take a bit longer.";
  }
  return wait != null && wait > 0
    ? `Kuhinja je trenutno zauzeta — računajte na ~${wait} min čekanja.`
    : "Kuhinja je trenutno zauzeta — narudžbe mogu potrajati malo duže.";
}

export function buildKitchenBusyPreorderMessage(input?: {
  language?: string | null;
  estimatedWaitMinutes?: number | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const wait = input?.estimatedWaitMinutes ?? 15;

  if (lang === "de") {
    return `Die Küche ist gerade stark ausgelastet — Wartezeit ca. ${wait} Min. Möchten Sie bestellen oder lieber warten?`;
  }
  if (lang === "en") {
    return `The kitchen is busy right now — wait time ~${wait} min. Would you like to order or wait?`;
  }
  return `Kuhinja je trenutno zauzeta, vreme čekanja ~${wait} min — želite da naručite ili da sačekate?`;
}

export function buildDrinkRefillMessage(input?: {
  language?: string | null;
  drinkName?: string | null;
  happyHourActive?: boolean;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const drink = input?.drinkName?.trim() || "piće";

  if (input?.happyHourActive) {
    if (lang === "de") {
      return `Happy Hour läuft noch — möchten Sie noch ein ${drink}?`;
    }
    if (lang === "en") {
      return `Happy hour is still on — want another ${drink}?`;
    }
    return `Još uvek važi happy hour — hoćete još jedno ${drink}?`;
  }

  if (lang === "de") {
    return `Möchten Sie noch ein ${drink}? Oder etwas anderes probieren?`;
  }
  if (lang === "en") {
    return `Would you like another ${drink}? Or try something different?`;
  }
  return `Hoćete li još jedno ${drink}? Ili da probate nešto drugo?`;
}

export function buildDrinkWithFoodMessage(input?: {
  language?: string | null;
  foodName?: string | null;
  drinkName?: string | null;
  serveSize?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const food = input?.foodName?.trim() || "jelo";
  const drink = input?.drinkName?.trim();
  const serve = input?.serveSize?.trim();
  const drinkLabel = drink ? (serve ? `${drink} ${serve}` : drink) : "piće";

  if (!drink) {
    if (lang === "de") return `Zu ${food} passt ein Getränk — soll ich etwas vorschlagen?`;
    if (lang === "en") return `${food} pairs well with a drink — want a suggestion?`;
    return `Uz ${food} odlično ide piće — da preporučim nešto?`;
  }

  if (lang === "de") {
    return `Zu ${food} passt ${drinkLabel} — soll ich eins hinzufügen?`;
  }
  if (lang === "en") {
    return `${drinkLabel} goes great with ${food} — want one?`;
  }
  return `Uz ${food} odlično ide ${drinkLabel} — hoćete?`;
}

export function buildRoundTwoMessage(input?: {
  language?: string | null;
  drinkName?: string | null;
  partySize?: number;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const drink = input?.drinkName?.trim() || "piće";

  if (lang === "de") {
    return `Noch eine Runde für den Tisch? ${drink} für alle?`;
  }
  if (lang === "en") {
    return `Another round for the table? ${drink} for everyone?`;
  }
  return `Još jedna runda za sto? ${drink} za sve?`;
}

export function buildHappyHourUpsellMessage(input?: {
  language?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  if (lang === "de") {
    return "Gerade Happy Hour — alle Getränke zum Sonderpreis!";
  }
  if (lang === "en") {
    return "It's Happy Hour — all drinks at special prices!";
  }
  return "Trenutno je Happy Hour — sva pića po specijalnoj ceni!";
}

export function buildOrderPreparingNotifyMessage(input?: {
  language?: string | null;
  orderItemsLabel?: string | null;
  remainingEtaMinutes?: number | null;
  estimatedPrepMinutes?: number | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const eta =
    input?.remainingEtaMinutes ??
    input?.estimatedPrepMinutes ??
    8;
  const items = input?.orderItemsLabel?.trim();
  const primaryItem =
    items?.split("+")[0]?.replace(/^\d+x\s*/i, "").trim() || "jelo";

  if (lang === "de") {
    return `${primaryItem} ist auf dem Grill, ~${eta} Min.`;
  }
  if (lang === "en") {
    return `Your ${primaryItem} is on the grill, ~${eta} min`;
  }
  return `Vaš ${primaryItem} je na grilu, ~${eta} min`;
}

export function buildOrderEtaUpdateMessage(input?: {
  language?: string | null;
  remainingEtaMinutes?: number | null;
  estimatedPrepMinutes?: number | null;
  orderItemsLabel?: string | null;
  waitMinutes?: number;
}): string {
  return buildOrderDelayMessage(input);
}

export function buildPopularityMessage(
  pair: { from: string; to: string } | null | undefined,
  fallback: string
): string {
  if (!pair?.from?.trim() || !pair?.to?.trim()) return fallback;
  return `Gosti koji naruče ${pair.from} često uzmu i ${pair.to}. Hoćete da dodam?`;
}

export function buildCookingGrillStartedMessage(input?: {
  language?: string | null;
  orderItemsLabel?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const items = input?.orderItemsLabel?.trim();

  if (lang === "de") {
    return items
      ? `🔥 ${items} ${items.includes("+") ? "sind" : "ist"} auf dem Grill!`
      : "🔥 Ihre Bestellung ist auf dem Grill!";
  }
  if (lang === "en") {
    return items
      ? `🔥 ${items} ${items.includes("+") ? "are" : "is"} on the grill!`
      : "🔥 Your order is on the grill!";
  }
  return items
    ? `🔥 ${items} ${items.includes("+") ? "su" : "je"} na grilu!`
    : "🔥 Vaša narudžbina je na grilu!";
}

export function buildCookingPlatingMessage(input?: {
  language?: string | null;
  orderItemsLabel?: string | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const items = input?.orderItemsLabel?.trim();

  if (lang === "de") {
    return items ? `${items} ${items.includes("+") ? "werden" : "wird"} serviert!` : "Wird gerade serviert!";
  }
  if (lang === "en") {
    return items ? `${items} ${items.includes("+") ? "are" : "is"} being served!` : "Being served right now!";
  }
  return items ? `${items} — upravo se servira!` : "Upravo se servira!";
}

export function buildStationBottleneckMessage(input?: {
  language?: string | null;
  productName?: string | null;
  alternativeName?: string | null;
  prepMinutes?: number | null;
}): string {
  const lang = resolveKitchenLang(input?.language);
  const alt = input?.alternativeName?.trim() || "brza alternativa";
  const prep = input?.prepMinutes ?? 8;

  if (lang === "de") {
    return `Gegrillte Gerichte sind heute Abend beliebt! Unser ${alt} ist eine tolle Alternative (ca. ${prep} Min.).`;
  }
  if (lang === "en") {
    return `Grilled dishes are popular tonight! Our ${alt} is a great alternative (~${prep} min).`;
  }
  return `Grilovana jela su popularna večeras! Naše ${alt} je odlična alternativa (gotovo za ${prep} min).`;
}

export function buildPreorderKitchenHeadsUpMessage(input: {
  tableName: string;
  partySize: number;
}): string {
  return `Heads up — sto ${input.tableName}, ${input.partySize} osoba, verovatno velika narudžbina.`;
}
