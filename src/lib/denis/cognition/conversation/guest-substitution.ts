const SUBSTITUTION_PATTERN =
  /\b(?:umesto|instead of|statt)\s+(.+?)(?:\s*[,.]|$)|(.+?)\s+(?:umesto|instead of|statt)\s+(.+)/i;

const FRIES_WORD =
  /\b(pomfri\w*|pones\w*|pommes|fries|kartoffel\s*salat\w*|kartoffelsalat)\b/i;

const GENERIC_BEER_SEGMENT =
  /^(?:jedn[oa]\s+)?(?:pivo|piva|beer|bier)(?:\s|$)/i;

export type GuestSubstitutionRequest = {
  requested: string;
  insteadOf: string;
  rawPhrase: string;
};

export function parseGuestSubstitution(segment: string): GuestSubstitutionRequest | null {
  const text = segment.trim();
  if (!text) return null;

  const umestoMatch = text.match(
    /\b(.+?)\s+umesto\s+(.+?)(?:\s*[,.]|$)/i
  );
  if (umestoMatch?.[1] && umestoMatch[2]) {
    const requested = umestoMatch[1].trim();
    const insteadOf = umestoMatch[2].trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf, rawPhrase: umestoMatch[0] };
    }
  }

  const insteadMatch = text.match(/\b(?:instead of|statt)\s+(.+)/i);
  if (insteadMatch?.[1]) {
    const insteadOf = insteadMatch[1].trim();
    const requested = text
      .replace(/\b(?:instead of|statt)\s+.+$/i, "")
      .trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf, rawPhrase: text };
    }
  }

  if (SUBSTITUTION_PATTERN.test(text)) {
    return null;
  }

  return null;
}

export function isGenericBeerSegment(segment: string): boolean {
  const normalized = segment.trim().toLowerCase();
  if (!normalized) return false;
  if (/\b(pilsner|weizen|lager|radler|kisel\w*|cola|sprite)\b/i.test(normalized)) {
    return false;
  }
  return GENERIC_BEER_SEGMENT.test(normalized);
}

export function substitutionReplacesFries(sub: GuestSubstitutionRequest): boolean {
  return FRIES_WORD.test(sub.insteadOf);
}

/** Guest-facing plan when auto-modifiers are uncertain. */
export function buildSubstitutionNegotiationMessage(
  language: string,
  input: {
    cartSummary: string | null;
    substitution: GuestSubstitutionRequest | null;
    needsDrinkClarify: boolean;
    waiterEscalationOffered?: boolean;
  }
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const cart = input.cartSummary?.trim();
  const sub = input.substitution;

  if (lang === "sr" || lang === "hr") {
    const parts: string[] = [];

    if (cart) {
      parts.push(`U redu — dodajem ${cart}.`);
    }

    if (sub) {
      parts.push(
        `Za zamenu (${sub.requested} umesto ${sub.insteadOf}) proveravam sa kuhinjom — staviću napomenu uz porudžbinu.`
      );
      parts.push(
        "Ako želite, mogu odmah da pozovem konobara da potvrdi da li je moguće."
      );
    }

    if (input.needsDrinkClarify) {
      parts.push("Za piće — koji tip želite? Na primer Pilsner ili Weizen, 0.3L ili 0.5L.");
    }

    if (!parts.length) {
      return "Razumem. Recite mi šta tačno želite, pa ću složiti porudžbinu korak po korak.";
    }

    return parts.join(" ");
  }

  if (lang === "de") {
    const parts: string[] = [];
    if (cart) parts.push(`Alles klar — ich nehme ${cart} auf.`);
    if (sub) {
      parts.push(
        `Für die Änderung (${sub.requested} statt ${sub.insteadOf}) gebe ich eine Notiz mit — die Küche muss das bestätigen.`
      );
      parts.push("Soll ich den Service rufen, damit wir das kurz klären?");
    }
    if (input.needsDrinkClarify) {
      parts.push("Zum Getränk: Welches Bier möchten Sie — z. B. Pilsner oder Weizen?");
    }
    return (
      parts.join(" ") ||
      "Verstanden. Sagen Sie mir bitte, was Sie möchten, dann gehen wir Schritt für Schritt vor."
    );
  }

  const parts: string[] = [];
  if (cart) parts.push(`Got it — adding ${cart}.`);
  if (sub) {
    parts.push(
      `For the swap (${sub.requested} instead of ${sub.insteadOf}) I'll add a note — the kitchen needs to confirm.`
    );
    parts.push("I can call a waiter now to double-check if you'd like.");
  }
  if (input.needsDrinkClarify) {
    parts.push("For the drink — which type would you like, e.g. Pilsner or Weizen?");
  }
  return (
    parts.join(" ") ||
    "Understood. Tell me what you'd like and we'll build the order step by step."
  );
}
