import {
  buildVenueWelcomeMessage,
} from "@/lib/denis/cognition/conversation/guest-continuity";

export function buildWelcomeMessage(
  venueName: string | null | undefined,
  language: string | null | undefined,
  todaySpecial: string | null | undefined,
  fallback: string,
  rhythmTopProductName?: string | null
): string {
  const special = todaySpecial?.trim();
  const venue = venueName?.trim();
  const lang = language?.trim() || "sr";
  const rhythmProduct = rhythmTopProductName?.trim();
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
    return `Dobro došli! ${rhythmProduct} je večeras favorit. Hoćete da pogledate meni?`;
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

export function buildPopularityMessage(
  pair: { from: string; to: string } | null | undefined,
  fallback: string
): string {
  if (!pair?.from?.trim() || !pair?.to?.trim()) return fallback;
  return `Gosti koji naruče ${pair.from} često uzmu i ${pair.to}. Hoćete da dodam?`;
}
